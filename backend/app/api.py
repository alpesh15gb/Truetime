from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from . import auth, crud, ingestion, schemas
from .db import get_session
from .enums import UserRole

router = APIRouter()


@router.post("/auth/token", response_model=schemas.TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    return await auth.login_for_access_token(form_data, session)


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
