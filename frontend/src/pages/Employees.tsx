import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowPathIcon, BoltIcon, UserPlusIcon } from "@heroicons/react/24/outline";

import {
  createDevice,
  createEmployee,
  fetchDevices,
  fetchEmployees,
  syncDevice
} from "../lib/api";
import type { DeviceCreate, EmployeeCreate } from "../types";
import { formatRelativeTime } from "../utils/format";

const initialEmployee: EmployeeCreate = {
  code: "",
  first_name: "",
  last_name: "",
  department: ""
};

const initialDevice: DeviceCreate = {
  name: "",
  model: "",
  serial_number: "",
  ip_address: "",
  port: 4370,
  comm_key: ""
};

export const EmployeesPage = () => {
  const queryClient = useQueryClient();
  const [employeeForm, setEmployeeForm] = useState(initialEmployee);
  const [deviceForm, setDeviceForm] = useState(initialDevice);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [syncingSerial, setSyncingSerial] = useState<string | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees
  });

  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: fetchDevices
  });

  const employeeMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEmployeeForm(initialEmployee);
      setBanner({ type: "success", message: "Employee saved" });
    },
    onError: (error: any) => {
      setBanner({
        type: "error",
        message: error?.response?.data?.detail ?? "Unable to create employee"
      });
    }
  });

  const deviceMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeviceForm(initialDevice);
      setBanner({ type: "success", message: "Device registered" });
    },
    onError: (error: any) => {
      setBanner({
        type: "error",
        message: error?.response?.data?.detail ?? "Unable to register device"
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: syncDevice,
    onMutate: (serialNumber: string) => {
      setSyncingSerial(serialNumber);
      setBanner(null);
    },
    onSuccess: (_, serialNumber) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setBanner({ type: "success", message: `Manual sync triggered for ${serialNumber}` });
    },
    onError: (error: any, serialNumber) => {
      setBanner({
        type: "error",
        message:
          error?.response?.data?.detail ?? `Unable to sync device ${serialNumber}. Check connectivity and try again.`
      });
    },
    onSettled: () => {
      setSyncingSerial(null);
    }
  });

  const handleEmployeeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    employeeMutation.mutate(employeeForm);
  };

  const handleDeviceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    deviceMutation.mutate(deviceForm);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Workforce directory</h1>
          <p className="text-sm text-slate-500">Manage employees and connected biometric terminals.</p>
        </div>
      </div>

      {banner ? (
        <div
          className={
            banner.type === "success"
              ? "rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          }
        >
          {banner.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleEmployeeSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Add employee</h2>
              <p className="text-sm text-slate-500">Generate a new profile for biometric enrolment.</p>
            </div>
            <div className="hidden rounded-2xl bg-primary/10 p-3 text-primary lg:block">
              <UserPlusIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Employee code</span>
              <input
                required
                value={employeeForm.code}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, code: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="EMP123"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Department</span>
              <input
                value={employeeForm.department ?? ""}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, department: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Operations"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">First name</span>
              <input
                required
                value={employeeForm.first_name}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, first_name: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Last name</span>
              <input
                required
                value={employeeForm.last_name}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, last_name: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={employeeMutation.isLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {employeeMutation.isLoading ? (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>

        <form
          onSubmit={handleDeviceSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Register biometric device</h2>
              <p className="text-sm text-slate-500">Track terminal connectivity by storing its network identity.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Device name</span>
              <input
                required
                value={deviceForm.name}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="HQ Lobby"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Model</span>
              <input
                required
                value={deviceForm.model}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, model: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="X990"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Serial number</span>
              <input
                required
                value={deviceForm.serial_number}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, serial_number: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="SN123"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">IP address</span>
              <input
                required
                value={deviceForm.ip_address}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, ip_address: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="192.168.0.10"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Port</span>
              <input
                required
                type="number"
                min={1}
                value={deviceForm.port ?? 4370}
                onChange={(event) =>
                  setDeviceForm((prev) => ({ ...prev, port: Number(event.target.value) || 4370 }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="4370"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Communication key</span>
              <input
                value={deviceForm.comm_key ?? ""}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, comm_key: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={deviceMutation.isLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deviceMutation.isLoading ? (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
          {employeesLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <ArrowPathIcon className="h-4 w-4 animate-spin" /> Loading employees...
            </div>
          ) : null}
          <ul className="mt-4 space-y-3">
            {employees?.map((employee) => (
              <li key={employee.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {employee.first_name} {employee.last_name}
                  </p>
                  <p className="text-xs text-slate-400">{employee.code}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {employee.department ?? "Unassigned"}
                </span>
              </li>
            ))}
            {employees && employees.length === 0 ? (
              <p className="text-sm text-slate-500">No employees created yet.</p>
            ) : null}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-800">Devices</h2>
          <ul className="mt-4 space-y-3">
            {devices?.map((device) => (
              <li key={device.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{device.name}</p>
                  <p className="text-xs text-slate-400">
                    {device.model} · {device.serial_number}
                  </p>
                  <p className="text-xs text-slate-400">
                    {device.ip_address}:{device.port} · Last sync {formatRelativeTime(device.last_sync_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => syncMutation.mutate(device.serial_number)}
                  disabled={syncingSerial === device.serial_number}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingSerial === device.serial_number ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <BoltIcon className="h-4 w-4" /> Sync now
                    </>
                  )}
                </button>
              </li>
            ))}
            {devices && devices.length === 0 ? (
              <p className="text-sm text-slate-500">No devices registered yet.</p>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
};
