from __future__ import annotations

from datetime import date, datetime, time
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .enums import UserRole


class UserRoleEnum(PyEnum):
    ADMIN = UserRole.ADMIN.value
    MANAGER = UserRole.MANAGER.value
    VIEWER = UserRole.VIEWER.value


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    attendance_logs: Mapped[list[AttendanceLog]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    shift_assignments: Mapped[list["EmployeeShiftAssignment"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )


class BiometricDevice(Base, TimestampMixin):
    __tablename__ = "biometric_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    model: Mapped[str] = mapped_column(String(50))
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(45))
    port: Mapped[int] = mapped_column(Integer, default=4370)
    comm_key: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    last_log_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    attendance_logs: Mapped[list[AttendanceLog]] = relationship(back_populates="device")


class AttendanceLog(Base, TimestampMixin):
    __tablename__ = "attendance_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    punched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    direction: Mapped[str] = mapped_column(String(10))
    raw_payload: Mapped[str] = mapped_column(String(255))
    external_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("biometric_devices.id"), index=True)

    employee: Mapped[Employee] = relationship(back_populates="attendance_logs")
    device: Mapped[BiometricDevice] = relationship(back_populates="attendance_logs")


class Shift(Base, TimestampMixin):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    start_time: Mapped[time] = mapped_column(Time(timezone=False))
    end_time: Mapped[time] = mapped_column(Time(timezone=False))
    grace_minutes: Mapped[int] = mapped_column(default=0)

    assignments: Mapped[list["EmployeeShiftAssignment"]] = relationship(
        back_populates="shift", cascade="all, delete-orphan"
    )


class EmployeeShiftAssignment(Base, TimestampMixin):
    __tablename__ = "employee_shift_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"), index=True)
    effective_from: Mapped[date] = mapped_column(Date())
    effective_to: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)

    employee: Mapped[Employee] = relationship(back_populates="shift_assignments")
    shift: Mapped[Shift] = relationship(back_populates="assignments")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRoleEnum] = mapped_column(
        Enum(UserRoleEnum, name="user_roles", native_enum=False, create_constraint=True),
        default=UserRoleEnum.VIEWER,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
