import axios from "axios";

import type {
  AttendanceLog,
  AttendanceSummary,
  DashboardResponse,
  Device,
  DeviceCreate,
  Employee,
  EmployeeCreate,
  LoginPayload,
  PaginatedResponse,
  Shift,
  ShiftAssignment,
  ShiftCreate,
  TokenResponse,
  User,
  UserCreate
} from "../types";

const sanitizeBaseUrl = (url: string): string => url.replace(/\/$/, "");

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

const resolveBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return sanitizeBaseUrl(envUrl);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = sanitizeBaseUrl(window.location.origin);
    if (isLocalhostOrigin(origin)) {
      return "http://localhost:8000/api";
    }
    return `${origin}/api`;
  }

  return "http://localhost:8000/api";
};

const baseURL = resolveBaseUrl();

let authToken: string | null = null;

export const apiClient = axios.create({
  baseURL,
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (!token && apiClient.defaults.headers.common.Authorization) {
    delete apiClient.defaults.headers.common.Authorization;
  }
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
};

export const loginRequest = async (credentials: LoginPayload): Promise<TokenResponse> => {
  const params = new URLSearchParams();
  params.append("username", credentials.email);
  params.append("password", credentials.password);
  const { data } = await apiClient.post<TokenResponse>("/auth/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  return data;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
};

export const createUser = async (payload: UserCreate): Promise<User> => {
  const { data } = await apiClient.post<User>("/users", payload);
  return data;
};

export const fetchEmployees = async (): Promise<Employee[]> => {
  const { data } = await apiClient.get<Employee[]>("/employees");
  return data;
};

export const createEmployee = async (payload: EmployeeCreate): Promise<Employee> => {
  const { data } = await apiClient.post<Employee>("/employees", payload);
  return data;
};

export const fetchDevices = async (): Promise<Device[]> => {
  const { data } = await apiClient.get<Device[]>("/devices");
  return data;
};

export const createDevice = async (payload: DeviceCreate): Promise<Device> => {
  const { data } = await apiClient.post<Device>("/devices", payload);
  return data;
};

export const syncDevice = async (serialNumber: string): Promise<AttendanceLog[]> => {
  const { data } = await apiClient.post<AttendanceLog[]>(`/devices/${serialNumber}/sync`);
  return data;
};

export const fetchShifts = async (): Promise<Shift[]> => {
  const { data } = await apiClient.get<Shift[]>("/shifts");
  return data;
};

export const createShift = async (payload: ShiftCreate): Promise<Shift> => {
  const { data } = await apiClient.post<Shift>("/shifts", payload);
  return data;
};

export interface ShiftAssignmentPayload {
  shift_id: number;
  effective_from: string;
  effective_to?: string | null;
}

export const assignShift = async (
  employeeCode: string,
  payload: ShiftAssignmentPayload
): Promise<ShiftAssignment> => {
  const { data } = await apiClient.post<ShiftAssignment>(`/employees/${employeeCode}/shift`, payload);
  return data;
};

export interface AttendanceLogFilters {
  employee_code?: string;
  device_serial?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

export const fetchAttendanceLogs = async (
  params: AttendanceLogFilters = {}
): Promise<PaginatedResponse<AttendanceLog>> => {
  const { data } = await apiClient.get<PaginatedResponse<AttendanceLog>>(
    "/attendance/logs",
    { params }
  );
  return data;
};

export const fetchDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await apiClient.get<DashboardResponse>("/dashboard");
  return data;
};

export const fetchAttendanceSummaries = async (
  params: { day?: string } = {}
): Promise<AttendanceSummary[]> => {
  const { data } = await apiClient.get<AttendanceSummary[]>("/attendance/summaries", { params });
  return data;
};
