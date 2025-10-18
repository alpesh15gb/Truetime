"""initial schema"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202405200001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("department", sa.String(length=100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_employees_code", "employees", ["code"], unique=True)

    op.create_table(
        "biometric_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=50), nullable=False),
        sa.Column("serial_number", sa.String(length=100), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="4370"),
        sa.Column("comm_key", sa.String(length=32)),
        sa.Column("last_log_id", sa.Integer()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_biometric_devices_serial_number", "biometric_devices", ["serial_number"], unique=True)

    op.create_table(
        "shifts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ux_shifts_name", "shifts", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("admin", "manager", "viewer", name="user_roles", native_enum=False), nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="ux_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "employee_shift_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_id", sa.Integer(), sa.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_employee_shift_assignments_employee_id", "employee_shift_assignments", ["employee_id"])
    op.create_index("ix_employee_shift_assignments_shift_id", "employee_shift_assignments", ["shift_id"])

    op.create_table(
        "attendance_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("punched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("raw_payload", sa.String(length=255), nullable=False),
        sa.Column("external_id", sa.Integer()),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("biometric_devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_attendance_logs_punched_at", "attendance_logs", ["punched_at"])
    op.create_index("ix_attendance_logs_employee_id", "attendance_logs", ["employee_id"])
    op.create_index("ix_attendance_logs_device_id", "attendance_logs", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_attendance_logs_device_id", table_name="attendance_logs")
    op.drop_index("ix_attendance_logs_employee_id", table_name="attendance_logs")
    op.drop_index("ix_attendance_logs_punched_at", table_name="attendance_logs")
    op.drop_table("attendance_logs")

    op.drop_index("ix_employee_shift_assignments_shift_id", table_name="employee_shift_assignments")
    op.drop_index("ix_employee_shift_assignments_employee_id", table_name="employee_shift_assignments")
    op.drop_table("employee_shift_assignments")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ux_shifts_name", table_name="shifts")
    op.drop_table("shifts")

    op.drop_index("ix_biometric_devices_serial_number", table_name="biometric_devices")
    op.drop_table("biometric_devices")

    op.drop_index("ix_employees_code", table_name="employees")
    op.drop_table("employees")
