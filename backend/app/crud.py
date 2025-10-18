from __future__ import annotations

from datetime import date, datetime, time as time_, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from . import models, schemas
from .enums import UserRole
from .security import get_password_hash


class CRUDException(Exception):
    """Base exception for CRUD errors."""


class DuplicateError(CRUDException):
    pass


async def create_employee(session: AsyncSession, payload: schemas.EmployeeCreate) -> models.Employee:
    employee = models.Employee(**payload.model_dump())
    session.add(employee)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateError("Employee with this code already exists") from exc
    await session.refresh(employee)
    return employee


async def list_employees(session: AsyncSession) -> list[models.Employee]:
    result = await session.execute(select(models.Employee).order_by(models.Employee.code))
    return list(result.scalars().all())


async def create_device(session: AsyncSession, payload: schemas.DeviceCreate) -> models.BiometricDevice:
    data = payload.model_dump()
    if not data.get("comm_key"):
        data["comm_key"] = None
    device = models.BiometricDevice(**data)
    session.add(device)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateError("Device with this serial number already exists") from exc
    await session.refresh(device)
    return device


async def list_devices(session: AsyncSession) -> list[models.BiometricDevice]:
    result = await session.execute(select(models.BiometricDevice).order_by(models.BiometricDevice.name))
    return list(result.scalars().all())


async def create_shift(session: AsyncSession, payload: schemas.ShiftCreate) -> models.Shift:
    shift = models.Shift(**payload.model_dump())
    session.add(shift)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateError("Shift with this name already exists") from exc
    await session.refresh(shift)
    return shift


async def list_shifts(session: AsyncSession) -> list[models.Shift]:
    result = await session.execute(select(models.Shift).order_by(models.Shift.start_time))
    return list(result.scalars().all())


async def get_device_by_serial(
    session: AsyncSession, serial_number: str
) -> Optional[models.BiometricDevice]:
    result = await session.execute(
        select(models.BiometricDevice).where(models.BiometricDevice.serial_number == serial_number)
    )
    return result.scalar_one_or_none()


async def get_employee_by_code(session: AsyncSession, code: str) -> Optional[models.Employee]:
    result = await session.execute(select(models.Employee).where(models.Employee.code == code))
    return result.scalar_one_or_none()


async def get_shift_assignment_for_date(
    session: AsyncSession, employee_id: int, on_date: date
) -> Optional[models.EmployeeShiftAssignment]:
    stmt = (
        select(models.EmployeeShiftAssignment)
        .options(joinedload(models.EmployeeShiftAssignment.shift))
        .where(
            models.EmployeeShiftAssignment.employee_id == employee_id,
            models.EmployeeShiftAssignment.effective_from <= on_date,
            or_(
                models.EmployeeShiftAssignment.effective_to.is_(None),
                models.EmployeeShiftAssignment.effective_to >= on_date,
            ),
        )
        .order_by(models.EmployeeShiftAssignment.effective_from.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def assign_shift_to_employee(
    session: AsyncSession, employee_code: str, payload: schemas.ShiftAssignmentCreate
) -> models.EmployeeShiftAssignment:
    employee = await get_employee_by_code(session, employee_code)
    if not employee:
        raise CRUDException("Employee not found")

    shift = await session.get(models.Shift, payload.shift_id)
    if not shift:
        raise CRUDException("Shift not found")

    overlapping_stmt = select(models.EmployeeShiftAssignment).where(
        models.EmployeeShiftAssignment.employee_id == employee.id,
        models.EmployeeShiftAssignment.effective_to.is_(None)
        | (models.EmployeeShiftAssignment.effective_to >= payload.effective_from),
    )
    overlapping_assignments = (await session.execute(overlapping_stmt)).scalars().all()
    for assignment in overlapping_assignments:
        if assignment.effective_from <= payload.effective_from and (
            assignment.effective_to is None or assignment.effective_to >= payload.effective_from
        ):
            assignment.effective_to = payload.effective_from - timedelta(days=1)

    assignment = models.EmployeeShiftAssignment(
        employee=employee,
        shift=shift,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )
    session.add(assignment)
    await session.commit()

    result = await session.execute(
        select(models.EmployeeShiftAssignment)
        .options(joinedload(models.EmployeeShiftAssignment.shift))
        .where(models.EmployeeShiftAssignment.id == assignment.id)
    )
    return result.scalar_one()


async def record_attendance_log(
    session: AsyncSession, payload: schemas.AttendanceLogCreate
) -> models.AttendanceLog:
    employee = await get_employee_by_code(session, payload.employee_code)
    if not employee:
        raise CRUDException("Employee not found")

    device = await get_device_by_serial(session, payload.device_serial)
    if not device:
        raise CRUDException("Device not found")

    if payload.external_id is not None:
        existing_stmt = (
            select(models.AttendanceLog)
            .options(
                joinedload(models.AttendanceLog.employee),
                joinedload(models.AttendanceLog.device),
            )
            .where(
                models.AttendanceLog.device_id == device.id,
                models.AttendanceLog.external_id == payload.external_id,
            )
            .limit(1)
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            now = datetime.now(timezone.utc)
            device.last_seen_at = now
            device.last_sync_at = now
            if payload.external_id and (
                not device.last_log_id or payload.external_id > device.last_log_id
            ):
                device.last_log_id = payload.external_id
            await session.commit()
            return existing

    log = models.AttendanceLog(
        punched_at=payload.punched_at,
        direction=payload.direction,
        raw_payload=payload.raw_payload,
        external_id=payload.external_id,
        employee=employee,
        device=device,
    )

    now = datetime.now(timezone.utc)
    device.last_seen_at = now
    device.last_sync_at = now

    if payload.external_id and (not device.last_log_id or payload.external_id > device.last_log_id):
        device.last_log_id = payload.external_id

    session.add(log)
    await session.commit()
    result = await session.execute(
        select(models.AttendanceLog)
        .options(joinedload(models.AttendanceLog.employee), joinedload(models.AttendanceLog.device))
        .where(models.AttendanceLog.id == log.id)
    )
    return result.scalar_one()


async def list_attendance_logs(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    employee_code: Optional[str] = None,
    device_serial: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
) -> tuple[int, list[models.AttendanceLog]]:
    query: Select[tuple[models.AttendanceLog]] = select(models.AttendanceLog).options(
        joinedload(models.AttendanceLog.employee), joinedload(models.AttendanceLog.device)
    )

    if employee_code:
        query = query.join(models.AttendanceLog.employee).where(models.Employee.code == employee_code)
    if device_serial:
        query = query.join(models.AttendanceLog.device).where(
            models.BiometricDevice.serial_number == device_serial
        )
    if from_time:
        query = query.where(models.AttendanceLog.punched_at >= from_time)
    if to_time:
        query = query.where(models.AttendanceLog.punched_at <= to_time)

    total_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(total_query)).scalar_one()

    query = query.order_by(models.AttendanceLog.punched_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    return total, list(result.scalars().unique().all())


async def get_dashboard_snapshot(
    session: AsyncSession, *, recent_limit: int = 10
) -> tuple[schemas.DashboardMetrics, list[models.AttendanceLog]]:
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)

    total_employees = (
        await session.execute(select(func.count(models.Employee.id)))
    ).scalar_one()
    total_devices = (
        await session.execute(select(func.count(models.BiometricDevice.id)))
    ).scalar_one()
    total_logs = (await session.execute(select(func.count(models.AttendanceLog.id)))).scalar_one()

    employees_recent = (
        await session.execute(
            select(func.count(func.distinct(models.AttendanceLog.employee_id))).where(
                models.AttendanceLog.punched_at >= last_24h
            )
        )
    ).scalar_one()

    devices_recent = (
        await session.execute(
            select(func.count(func.distinct(models.AttendanceLog.device_id))).where(
                models.AttendanceLog.punched_at >= last_24h
            )
        )
    ).scalar_one()

    logs_last_24h = (
        await session.execute(
            select(func.count(models.AttendanceLog.id)).where(
                models.AttendanceLog.punched_at >= last_24h
            )
        )
    ).scalar_one()

    latest_log_at = (
        await session.execute(select(func.max(models.AttendanceLog.punched_at)))
    ).scalar_one()

    recent_logs_query = (
        select(models.AttendanceLog)
        .options(joinedload(models.AttendanceLog.employee), joinedload(models.AttendanceLog.device))
        .order_by(models.AttendanceLog.punched_at.desc())
        .limit(recent_limit)
    )
    recent_logs = list((await session.execute(recent_logs_query)).scalars().unique().all())

    metrics = schemas.DashboardMetrics(
        total_employees=total_employees,
        employees_with_recent_logs=employees_recent,
        total_devices=total_devices,
        devices_reporting=devices_recent,
        total_logs=total_logs,
        logs_last_24h=logs_last_24h,
        latest_log_at=latest_log_at,
    )

    return metrics, recent_logs


def _expected_minutes_for_shift(shift: models.Shift) -> int:
    start_dt = datetime.combine(date.today(), shift.start_time)
    end_dt = datetime.combine(date.today(), shift.end_time)
    if shift.end_time <= shift.start_time:
        end_dt += timedelta(days=1)
    return int((end_dt - start_dt).total_seconds() // 60)


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _calculate_work_minutes(
    logs: list[models.AttendanceLog],
) -> tuple[int, Optional[datetime], Optional[datetime], Optional[datetime]]:
    total_minutes = 0
    open_in: Optional[datetime] = None
    first_in: Optional[datetime] = None
    last_out: Optional[datetime] = None

    for log in sorted(logs, key=lambda item: item.punched_at):
        timestamp = _normalize_datetime(log.punched_at)
        direction = log.direction.lower()
        if direction.startswith("in"):
            if first_in is None:
                first_in = timestamp
            open_in = timestamp
        elif direction.startswith("out"):
            last_out = timestamp
            if open_in:
                total_minutes += int((timestamp - open_in).total_seconds() // 60)
                open_in = None
        else:
            last_out = timestamp

    if last_out is None and logs:
        last_out = _normalize_datetime(logs[-1].punched_at)

    return total_minutes, first_in or None, last_out, open_in


async def list_daily_summaries(
    session: AsyncSession, target_date: date
) -> list[schemas.AttendanceSummary]:
    start_of_day = datetime.combine(target_date, time_.min).replace(tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    employee_result = await session.execute(select(models.Employee).order_by(models.Employee.code))
    employees = list(employee_result.scalars().all())
    summaries: list[schemas.AttendanceSummary] = []

    for employee in employees:
        logs_stmt = (
            select(models.AttendanceLog)
            .options(joinedload(models.AttendanceLog.device), joinedload(models.AttendanceLog.employee))
            .where(
                models.AttendanceLog.employee_id == employee.id,
                models.AttendanceLog.punched_at >= start_of_day,
                models.AttendanceLog.punched_at < end_of_day,
            )
            .order_by(models.AttendanceLog.punched_at.asc())
        )
        logs = list((await session.execute(logs_stmt)).scalars().unique().all())

        total_minutes, first_in, last_out, open_in = _calculate_work_minutes(logs)
        status: Literal["present", "late", "absent", "incomplete"]
        late_minutes: Optional[int] = None
        expected_minutes: Optional[int] = None

        assignment = await get_shift_assignment_for_date(session, employee.id, target_date)
        shift = assignment.shift if assignment else None

        if not logs:
            status = "absent"
        else:
            status = "present"
            if open_in is not None or first_in is None or last_out is None:
                status = "incomplete"

            if shift and first_in:
                expected_minutes = _expected_minutes_for_shift(shift)
                shift_start = datetime.combine(target_date, shift.start_time).replace(tzinfo=timezone.utc)
                grace = timedelta(minutes=shift.grace_minutes or 0)
                if first_in > shift_start + grace:
                    status = "late"
                    late_minutes = int((first_in - shift_start).total_seconds() // 60)
                else:
                    late_minutes = 0

        summaries.append(
            schemas.AttendanceSummary(
                date=target_date,
                employee=schemas.EmployeeRead.model_validate(employee),
                shift=schemas.ShiftRead.model_validate(shift) if shift else None,
                status=status,
                first_in=first_in,
                last_out=last_out,
                total_minutes=total_minutes,
                expected_minutes=expected_minutes,
                late_minutes=late_minutes,
            )
        )

    return summaries


async def create_user(session: AsyncSession, payload: schemas.UserCreate) -> models.User:
    role_value = payload.role.value if isinstance(payload.role, UserRole) else payload.role
    role = models.UserRoleEnum(UserRole.from_str(role_value).value)
    user = models.User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=role,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateError("User with this email already exists") from exc
    await session.refresh(user)
    return user


async def get_user_by_email(session: AsyncSession, email: str) -> models.User | None:
    result = await session.execute(
        select(models.User).where(models.User.email == email.lower())
    )
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: int) -> models.User | None:
    result = await session.execute(select(models.User).where(models.User.id == user_id))
    return result.scalar_one_or_none()


async def list_users(session: AsyncSession) -> list[models.User]:
    result = await session.execute(select(models.User).order_by(models.User.email))
    return list(result.scalars().all())
