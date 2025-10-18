from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Iterable, Optional, Protocol

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from . import crud, models, schemas
from .config import Settings, get_settings

logger = logging.getLogger(__name__)


try:  # pragma: no cover - import is validated indirectly in runtime flows
    from zk import ZK  # type: ignore
except Exception:  # pragma: no cover - optional dependency for production mode
    ZK = None  # type: ignore


class DeviceClientError(Exception):
    """Base exception raised when the device client fails."""


class DeviceConnectionError(DeviceClientError):
    """Raised when the device cannot be contacted."""


class DeviceClientProtocol(Protocol):
    async def fetch_logs(self) -> Iterable[dict]:
        ...


ClientFactory = Callable[[models.BiometricDevice], DeviceClientProtocol]


@dataclass(slots=True)
class MockDeviceClient(DeviceClientProtocol):
    """Simple mock used for development and automated testing."""

    serial_number: str
    _counter: int = 0

    async def fetch_logs(self) -> Iterable[dict]:
        await asyncio.sleep(0.1)
        self._counter += 1
        now = datetime.now(timezone.utc)
        return [
            {
                "external_id": self._counter,
                "employee_code": f"EMP{self._counter:03d}",
                "direction": "in" if self._counter % 2 else "out",
                "timestamp": now,
                "raw_payload": f"mock_payload_{self._counter}",
            }
        ]


class ESSLDeviceClient(DeviceClientProtocol):
    """Real client that communicates with an eSSL/ZKTeco terminal."""

    def __init__(
        self,
        device: models.BiometricDevice,
        *,
        timeout: int = 10,
        force_udp: bool = False,
    ) -> None:
        if ZK is None:  # pragma: no cover - depends on optional dependency
            raise DeviceConnectionError(
                "The 'zk' package is not installed. Install backend dependencies to enable device sync."
            )

        password: int = 0
        if device.comm_key:
            try:
                password = int(device.comm_key)
            except ValueError as exc:  # pragma: no cover - guarded in UI/API validation
                raise DeviceClientError("Device communication key must be numeric for the eSSL SDK") from exc

        self._zk = ZK(
            device.ip_address,
            port=device.port or 4370,
            timeout=timeout,
            password=password,
            force_udp=force_udp,
        )

    def _pull_records(self):
        connection = self._zk.connect()
        try:
            connection.disable_device()
            records = connection.get_attendance() or []
        finally:
            try:
                connection.enable_device()
            except Exception:  # pragma: no cover - best-effort clean up
                pass
            connection.disconnect()
        return records

    async def fetch_logs(self) -> Iterable[dict]:  # pragma: no cover - exercised via manual sync/integration
        try:
            records = await asyncio.to_thread(self._pull_records)
        except Exception as exc:
            raise DeviceConnectionError(f"Unable to fetch logs: {exc}") from exc

        payloads: list[dict] = []
        for record in records:
            timestamp = getattr(record, "timestamp", None)
            if not isinstance(timestamp, datetime):
                continue

            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

            employee_code = str(getattr(record, "user_id", "")).strip()
            if not employee_code:
                continue

            payloads.append(
                {
                    "external_id": getattr(record, "uid", None),
                    "employee_code": employee_code,
                    "direction": _derive_direction(record),
                    "timestamp": timestamp,
                    "raw_payload": json.dumps(getattr(record, "__dict__", {}), default=str),
                }
            )

        return payloads


def _derive_direction(record: object) -> str:
    punch = getattr(record, "punch", None)
    status = getattr(record, "status", None)

    if punch in {0, 4} or status in {0, 4}:  # 0/4 -> in
        return "in"
    if punch in {1, 5} or status in {1, 5}:  # 1/5 -> out
        return "out"
    return "in"


async def sync_device(
    session: AsyncSession,
    device: models.BiometricDevice,
    client: Optional[DeviceClientProtocol] = None,
    *,
    settings: Optional[Settings] = None,
) -> list[schemas.AttendanceLogRead]:
    """Pull new logs from a biometric device and persist them."""

    settings = settings or get_settings()
    client = client or resolve_client(device, settings=settings)

    try:
        payloads = await client.fetch_logs()
    except DeviceClientError:
        raise
    except Exception as exc:  # pragma: no cover - safety net
        raise DeviceClientError(str(exc)) from exc

    payload_list = list(payloads)
    highest_external_id = device.last_log_id or 0
    logs: list[schemas.AttendanceLogRead] = []

    for payload in payload_list:
        external_id = payload.get("external_id")
        if (
            external_id is not None
            and device.last_log_id is not None
            and external_id <= device.last_log_id
        ):
            continue

        employee_code = payload.get("employee_code")
        timestamp = payload.get("timestamp")
        if not employee_code or not isinstance(timestamp, datetime):
            continue

        direction = payload.get("direction", "in")
        raw_payload = payload.get("raw_payload", "")

        create_payload = schemas.AttendanceLogCreate(
            employee_code=employee_code,
            device_serial=device.serial_number,
            punched_at=timestamp,
            direction=direction,
            raw_payload=raw_payload,
            external_id=external_id,
        )

        try:
            attendance_log = await crud.record_attendance_log(session, create_payload)
        except crud.CRUDException as exc:
            logger.warning(
                "Skipping payload from %s due to validation error: %s", device.serial_number, exc
            )
            continue

        logs.append(schemas.AttendanceLogRead.model_validate(attendance_log))

        if external_id is not None and external_id > highest_external_id:
            highest_external_id = external_id

    now = datetime.now(timezone.utc)
    device.last_sync_at = now
    device.last_seen_at = now

    if highest_external_id and (device.last_log_id or 0) < highest_external_id:
        device.last_log_id = highest_external_id

    await session.commit()

    return logs


def resolve_client(
    device: models.BiometricDevice,
    *,
    settings: Optional[Settings] = None,
) -> DeviceClientProtocol:
    settings = settings or get_settings()
    return ESSLDeviceClient(
        device,
        timeout=settings.ingestion_connection_timeout,
        force_udp=settings.ingestion_force_udp,
    )


async def run_scheduler(
    session_factory: async_sessionmaker[AsyncSession],
    settings: Settings,
    *,
    client_factory: Optional[ClientFactory] = None,
) -> None:
    """Continuously poll registered devices on an interval."""

    poll_interval = max(settings.ingestion_poll_interval_seconds, 5)

    while True:
        try:
            async with session_factory() as session:
                devices = await crud.list_devices(session)
                for device in devices:
                    try:
                        client = (
                            client_factory(device)
                            if client_factory
                            else resolve_client(device, settings=settings)
                        )
                    except DeviceClientError as exc:
                        logger.warning(
                            "Unable to initialize client for %s (%s): %s",
                            device.serial_number,
                            device.ip_address,
                            exc,
                        )
                        continue

                    try:
                        await sync_device(session, device, client=client, settings=settings)
                    except DeviceClientError as exc:
                        logger.warning(
                            "Failed to sync device %s (%s): %s",
                            device.serial_number,
                            device.ip_address,
                            exc,
                        )
                    except Exception:  # pragma: no cover - catch-all for robustness
                        logger.exception(
                            "Unexpected error while syncing device %s", device.serial_number
                        )

        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover - safety net
            logger.exception("Unexpected failure in ingestion scheduler loop")

        await asyncio.sleep(poll_interval)
