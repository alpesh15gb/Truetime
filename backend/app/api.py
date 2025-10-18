from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from alembic import command
from alembic.config import Config
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from . import auth, crud, ingestion, schemas
from .config import get_settings
from .db import get_session
from .enums import UserRole
from .security import create_access_token

router = APIRouter()


@router.post("/auth/token", response_model=schemas.TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    return await auth.login_for_access_token(form_data, session)


@router.get("/auth/setup-status", response_model=schemas.SetupStatus)
async def get_setup_status(session: AsyncSession = Depends(get_session)) -> schemas.SetupStatus:
    has_users = await crud.users_exist(session)
    return schemas.SetupStatus(has_users=has_users)


@router.post(
    "/auth/initial-admin",
    response_model=schemas.TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_initial_admin(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> schemas.TokenResponse:
    try:
        if "application/x-www-form-urlencoded" in request.headers.get("content-type", ""):
            form = await request.form()
            payload_data: dict[str, Any] = {
                "email": form.get("email"),
                "full_name": form.get("full_name"),
                "password": form.get("password"),
            }
        else:
            payload_data = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload") from exc

    try:
        payload = schemas.InitialAdminCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid payload") from exc

    try:
        user = await crud.create_initial_admin(session, payload)
    except crud.OperationNotAllowed as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    settings = get_settings()
    expires = timedelta(minutes=settings.access_token_expire_minutes)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    token = create_access_token({"sub": user.email, "role": role_value}, expires)
    return schemas.TokenResponse(access_token=token)


@router.post(
    "/users",
    response_model=schemas.UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
async def create_user(payload: schemas.UserCreate, session: AsyncSession = Depends(get_session)):
    try:
        user = await crud.create_user(session, payload)
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return schemas.UserRead.model_validate(user)


@router.get(
    "/users",
    response_model=list[schemas.UserRead],
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def list_users(session: AsyncSession = Depends(get_session)):
    users = await crud.list_users(session)
    return [schemas.UserRead.model_validate(user) for user in users]


@router.patch(
    "/users/{user_id}",
    response_model=schemas.UserRead,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    session: AsyncSession = Depends(get_session),
):
    try:
        user = await crud.update_user(session, user_id, payload)
    except crud.NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return schemas.UserRead.model_validate(user)


@router.post(
    "/users/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def set_user_password(
    user_id: int,
    payload: schemas.UserPasswordUpdate,
    session: AsyncSession = Depends(get_session),
):
    try:
        await crud.set_user_password(session, user_id, payload.password)
    except crud.NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def delete_user(user_id: int, session: AsyncSession = Depends(get_session)):
    try:
        await crud.delete_user(session, user_id)
    except crud.NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/users/me", response_model=schemas.UserRead)
async def read_users_me(current_user=Depends(auth.get_current_active_user)):
    return schemas.UserRead.model_validate(current_user)


@router.post("/employees", response_model=schemas.EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: schemas.EmployeeCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
) -> schemas.EmployeeRead:
    try:
        employee = await crud.create_employee(session, payload)
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return schemas.EmployeeRead.model_validate(employee)


@router.get("/employees", response_model=list[schemas.EmployeeRead])
async def list_employees(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
) -> list[schemas.EmployeeRead]:
    employees = await crud.list_employees(session)
    return [schemas.EmployeeRead.model_validate(emp) for emp in employees]


@router.post("/devices", response_model=schemas.DeviceRead, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: schemas.DeviceCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    try:
        device = await crud.create_device(session, payload)
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return schemas.DeviceRead.model_validate(device)


@router.get("/devices", response_model=list[schemas.DeviceRead])
async def list_devices(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
) -> list[schemas.DeviceRead]:
    devices = await crud.list_devices(session)
    return [schemas.DeviceRead.model_validate(device) for device in devices]


@router.post(
    "/devices/{serial_number}/sync",
    response_model=list[schemas.AttendanceLogRead],
    status_code=status.HTTP_200_OK,
)
async def trigger_device_sync(
    serial_number: str,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
) -> list[schemas.AttendanceLogRead]:
    device = await crud.get_device_by_serial(session, serial_number)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    try:
        logs = await ingestion.sync_device(session, device)
    except ingestion.DeviceConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ingestion.DeviceClientError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return logs


@router.post("/shifts", response_model=schemas.ShiftRead, status_code=status.HTTP_201_CREATED)
async def create_shift(
    payload: schemas.ShiftCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    try:
        shift = await crud.create_shift(session, payload)
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return schemas.ShiftRead.model_validate(shift)


@router.get("/shifts", response_model=list[schemas.ShiftRead])
async def list_shifts(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
) -> list[schemas.ShiftRead]:
    shifts = await crud.list_shifts(session)
    return [schemas.ShiftRead.model_validate(shift) for shift in shifts]


async def _run_alembic_upgrade() -> None:
    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    alembic_config = Config(str(config_path))
    command.upgrade(alembic_config, "head")


@router.post(
    "/admin/run-migrations",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def run_migrations() -> dict[str, str]:
    try:
        await asyncio.to_thread(_run_alembic_upgrade)
    except Exception as exc:  # pragma: no cover - safety net
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return {"status": "migrated"}


@router.get(
    "/admin/system/config",
    response_model=schemas.SystemConfig,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def read_system_config(session: AsyncSession = Depends(get_session)):
    config = await crud.get_system_config(session)
    return schemas.SystemConfig.model_validate(config)


@router.patch(
    "/admin/system/config",
    response_model=schemas.SystemConfig,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def update_system_config(
    payload: schemas.SystemConfigUpdate,
    session: AsyncSession = Depends(get_session),
):
    config = await crud.update_system_config(session, payload)
    return schemas.SystemConfig.model_validate(config)


@router.post(
    "/admin/sql",
    response_model=schemas.SQLQueryResponse,
    dependencies=[Depends(auth.require_roles(UserRole.ADMIN))],
)
async def execute_sql(
    payload: schemas.SQLQueryRequest,
    session: AsyncSession = Depends(get_session),
):
    statement = payload.statement.strip()
    if not statement:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SQL statement cannot be empty")

    if not statement.lower().startswith("select"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only SELECT statements are allowed from the admin console",
        )

    try:
        columns, rows = await crud.execute_sql(session, statement, payload.parameters)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return schemas.SQLQueryResponse(columns=columns, rows=rows)


@router.post(
    "/attendance/logs",
    response_model=schemas.AttendanceLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def record_attendance_log(
    payload: schemas.AttendanceLogCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    try:
        log = await crud.record_attendance_log(session, payload)
    except crud.CRUDException as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return schemas.AttendanceLogRead.model_validate(log)


@router.get("/attendance/logs", response_model=schemas.PaginatedResponse)
async def list_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    employee_code: Optional[str] = None,
    device_serial: Optional[str] = None,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
):
    total, logs = await crud.list_attendance_logs(
        session,
        limit=limit,
        offset=offset,
        employee_code=employee_code,
        device_serial=device_serial,
        from_time=from_time,
        to_time=to_time,
    )
    items = [schemas.AttendanceLogRead.model_validate(log) for log in logs]
    return schemas.PaginatedResponse(total=total, items=items)


@router.post(
    "/employees/{employee_code}/shift",
    response_model=schemas.ShiftAssignmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def assign_shift(
    employee_code: str,
    payload: schemas.ShiftAssignmentCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    try:
        assignment = await crud.assign_shift_to_employee(session, employee_code, payload)
    except crud.DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except crud.CRUDException as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return schemas.ShiftAssignmentRead.model_validate(assignment)


@router.get("/dashboard", response_model=schemas.DashboardResponse)
async def get_dashboard_snapshot(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
):
    metrics, recent_logs = await crud.get_dashboard_snapshot(session)
    items = [schemas.AttendanceLogRead.model_validate(log) for log in recent_logs]
    return schemas.DashboardResponse(metrics=metrics, recent_logs=items)


@router.get("/attendance/summaries", response_model=list[schemas.AttendanceSummary])
async def get_attendance_summaries(
    day: date = Query(default=None, description="Target date for the summary. Defaults to today."),
    session: AsyncSession = Depends(get_session),
    _: object = Depends(auth.require_roles()),
):
    target_day = day or date.today()
    summaries = await crud.list_daily_summaries(session, target_day)
    return summaries
