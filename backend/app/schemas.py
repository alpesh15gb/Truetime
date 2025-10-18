from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from .enums import UserRole


class DeviceBase(BaseModel):
    name: str
    model: str
    serial_number: str
    ip_address: str
    port: int = 4370


class DeviceCreate(DeviceBase):
    comm_key: Optional[str] = None


class DeviceRead(DeviceBase):
    id: int
    last_log_id: Optional[int] = None
    last_seen_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeBase(BaseModel):
    code: str
    first_name: str
    last_name: str
    department: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeRead(EmployeeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ShiftBase(BaseModel):
    name: str
    start_time: time
    end_time: time
    grace_minutes: int = 0


class ShiftCreate(ShiftBase):
    pass


class ShiftRead(ShiftBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ShiftAssignmentCreate(BaseModel):
    shift_id: int
    effective_from: date
    effective_to: Optional[date] = None


class ShiftAssignmentRead(BaseModel):
    id: int
    effective_from: date
    effective_to: Optional[date] = None
    shift: ShiftRead

    model_config = ConfigDict(from_attributes=True)


class AttendanceLogCreate(BaseModel):
    employee_code: str
    device_serial: str
    punched_at: datetime
    direction: str
    raw_payload: str
    external_id: Optional[int] = None


class AttendanceLogRead(BaseModel):
    id: int
    punched_at: datetime
    direction: str
    raw_payload: str
    external_id: Optional[int] = None
    employee: EmployeeRead
    device: DeviceRead

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    total: int
    items: list[AttendanceLogRead]


class DashboardMetrics(BaseModel):
    total_employees: int
    employees_with_recent_logs: int
    total_devices: int
    devices_reporting: int
    total_logs: int
    logs_last_24h: int
    latest_log_at: Optional[datetime] = None


class DashboardResponse(BaseModel):
    metrics: DashboardMetrics
    recent_logs: list[AttendanceLogRead]


class AttendanceSummary(BaseModel):
    date: date
    employee: EmployeeRead
    shift: Optional[ShiftRead] = None
    status: Literal["present", "late", "absent", "incomplete"]
    first_in: Optional[datetime] = None
    last_out: Optional[datetime] = None
    total_minutes: int
    expected_minutes: Optional[int] = None
    late_minutes: Optional[int] = None


class UserBase(BaseModel):
    email: str
    full_name: str
    role: UserRole = UserRole.VIEWER


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: UserRole


class LoginRequest(BaseModel):
    email: str
    password: str
