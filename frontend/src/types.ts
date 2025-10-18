export type UserRole = "admin" | "manager" | "viewer";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface UserCreate {
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Employee {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  department?: string | null;
}

export interface EmployeeCreate {
  code: string;
  first_name: string;
  last_name: string;
  department?: string;
}

export interface Device {
  id: number;
  name: string;
  model: string;
  serial_number: string;
  ip_address: string;
  port: number;
  last_log_id?: number | null;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
}

export interface DeviceCreate {
  name: string;
  model: string;
  serial_number: string;
  ip_address: string;
  port?: number;
  comm_key?: string;
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
}

export interface ShiftCreate {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
}

export interface ShiftAssignment {
  id: number;
  effective_from: string;
  effective_to?: string | null;
  shift: Shift;
}

export interface AttendanceLog {
  id: number;
  punched_at: string;
  direction: string;
  raw_payload: string;
  external_id?: number | null;
  employee: Employee;
  device: Device;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export interface DashboardMetrics {
  total_employees: number;
  employees_with_recent_logs: number;
  total_devices: number;
  devices_reporting: number;
  total_logs: number;
  logs_last_24h: number;
  latest_log_at?: string | null;
}

export interface DashboardResponse {
  metrics: DashboardMetrics;
  recent_logs: AttendanceLog[];
}

export type AttendanceStatus = "present" | "late" | "absent" | "incomplete";

export interface AttendanceSummary {
  date: string;
  employee: Employee;
  shift?: Shift | null;
  status: AttendanceStatus;
  first_in?: string | null;
  last_out?: string | null;
  total_minutes: number;
  expected_minutes?: number | null;
  late_minutes?: number | null;
}
