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
  InitialAdminPayload,
  PaginatedResponse,
  Shift,
  ShiftAssignment,
  ShiftCreate,
  TokenResponse,
  User,
  UserCreate,
  UserUpdate,
  SystemConfig,
  SystemConfigUpdate,
  SqlQueryPayload,
  SqlQueryResult,
  SetupStatus
} from "../types";

const STORAGE_KEY = "truetime.apiBaseUrl";

const sanitizeBaseUrl = (url: string): string => url.replace(/\/$/, "");

const ensureApiPath = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/api";
    } else if (!parsed.pathname.startsWith("/api")) {
      parsed.pathname = "/api";
    } else if (parsed.pathname !== "/api") {
      parsed.pathname = "/api";
    }
    parsed.search = "";
    parsed.hash = "";
    return sanitizeBaseUrl(parsed.toString());
  } catch (error) {
    console.warn("Unable to normalize Truetime API base URL", error);
    return sanitizeBaseUrl(url);
  }
};

const getWindow = (): Window | null =>
  typeof window === "undefined" ? null : window;

const resolveDefaultBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return ensureApiPath(envUrl);
  }

  const win = getWindow();
  if (win?.location?.origin) {
    return ensureApiPath(win.location.origin);
  }

  return "http://localhost:8000/api";
};

const resolveStoredBaseUrl = (): string | null => {
  const win = getWindow();
  if (!win) {
    return null;
  }

  try {
    const stored = win.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return ensureApiPath(stored);
    }
  } catch (error) {
    console.warn("Unable to read stored Truetime API base URL", error);
  }

  return null;
};

let baseURL = resolveStoredBaseUrl() ?? resolveDefaultBaseUrl();

let authToken: string | null = null;

export const apiClient = axios.create({
  baseURL,
  timeout: 15000
});

const applyBaseUrl = (url: string) => {
  baseURL = url;
  apiClient.defaults.baseURL = url;
};

export const getApiBaseUrl = (): string => baseURL;

export const setApiBaseUrl = (url: string | null): string => {
  const sanitized = url && url.trim().length > 0 ? ensureApiPath(url) : null;
  const win = getWindow();

  if (win) {
    try {
      if (sanitized) {
        win.localStorage.setItem(STORAGE_KEY, sanitized);
      } else {
        win.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn("Unable to persist Truetime API base URL", error);
    }
  }

  const nextUrl = sanitized ?? resolveDefaultBaseUrl();
  applyBaseUrl(nextUrl);
  return nextUrl;
};

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

export const fetchSetupStatus = async (): Promise<SetupStatus> => {
  const { data } = await apiClient.get<SetupStatus>("/auth/setup-status");
  return data;
};

export const createInitialAdmin = async (
  payload: InitialAdminPayload
): Promise<TokenResponse> => {
  const { data } = await apiClient.post<TokenResponse>("/auth/initial-admin", payload);
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

export const fetchUsers = async (): Promise<User[]> => {
  const { data } = await apiClient.get<User[]>("/users");
  return data;
};

export const updateUser = async (userId: number, payload: UserUpdate): Promise<User> => {
  const { data } = await apiClient.patch<User>(`/users/${userId}`, payload);
  return data;
};

export const updateUserPassword = async (userId: number, password: string): Promise<void> => {
  await apiClient.post(`/users/${userId}/password`, { password });
};

export const deleteUser = async (userId: number): Promise<void> => {
  await apiClient.delete(`/users/${userId}`);
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

export const fetchSystemConfig = async (): Promise<SystemConfig> => {
  const { data } = await apiClient.get<SystemConfig>("/admin/system/config");
  return data;
};

export const updateSystemConfig = async (
  payload: SystemConfigUpdate
): Promise<SystemConfig> => {
  const { data } = await apiClient.patch<SystemConfig>("/admin/system/config", payload);
  return data;
};

export const runMigrations = async (): Promise<void> => {
  await apiClient.post("/admin/run-migrations", {});
};

export const executeSql = async (
  payload: SqlQueryPayload
): Promise<SqlQueryResult> => {
  const { data } = await apiClient.post<SqlQueryResult>("/admin/sql", payload);
  return data;
};
