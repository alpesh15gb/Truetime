import { useQuery } from "@tanstack/react-query";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { differenceInMinutes, parseISO } from "date-fns";

import { fetchDashboard, fetchDevices } from "../lib/api";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatFullName, formatRelativeTime } from "../utils/format";
import type { Device } from "../types";

export const DashboardPage = () => {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000
  });

  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: fetchDevices
  });

  if (dashboardLoading || !dashboard) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <ArrowPathIcon className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const metrics = dashboard.metrics;

  const resolveDeviceStatus = (device: Device) => {
    if (!device?.last_seen_at) {
      return {
        label: "Pending",
        badgeClass: "bg-amber-100 text-amber-600",
        dotClass: "bg-amber-500"
      };
    }

    try {
      const seenAt = parseISO(device.last_seen_at);
      const minutes = differenceInMinutes(new Date(), seenAt);
      if (minutes <= 5) {
        return {
          label: "Online",
          badgeClass: "bg-emerald-100 text-emerald-600",
          dotClass: "bg-emerald-500"
        };
      }
      if (minutes <= 30) {
        return {
          label: "Quiet",
          badgeClass: "bg-amber-100 text-amber-600",
          dotClass: "bg-amber-500"
        };
      }
      return {
        label: "Offline",
        badgeClass: "bg-rose-100 text-rose-600",
        dotClass: "bg-rose-500"
      };
    } catch (error) {
      return {
        label: "Pending",
        badgeClass: "bg-amber-100 text-amber-600",
        dotClass: "bg-amber-500"
      };
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Employees"
          value={metrics.total_employees}
          subtitle={`${metrics.employees_with_recent_logs} active in last 24h`}
        />
        <KpiCard
          title="Biometric Devices"
          value={metrics.total_devices}
          subtitle={`${metrics.devices_reporting} reporting in last 24h`}
        />
        <KpiCard
          title="Attendance Logs"
          value={metrics.total_logs}
          subtitle={`${metrics.logs_last_24h} captured in last 24h`}
        />
        <KpiCard
          title="Last Punch"
          value={metrics.latest_log_at ? formatDateTime(metrics.latest_log_at) : "No data"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Recent punches</h2>
              <p className="text-sm text-slate-500">Live feed of the most recent attendance events.</p>
            </div>
          </header>
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/70">
                {dashboard.recent_logs.map((log) => (
                  <tr key={log.id} className="hover:bg-primary/5">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      {formatFullName(log.employee.first_name, log.employee.last_name)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {log.employee.department ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {log.device.name} · {log.device.serial_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDateTime(log.punched_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={log.direction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="lg:col-span-4">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h3 className="text-lg font-semibold text-slate-800">Device health</h3>
            <p className="mt-1 text-sm text-slate-500">Keep an eye on device connectivity.</p>
            <ul className="mt-4 space-y-3">
              {devices?.map((device) => {
                const status = resolveDeviceStatus(device);
                return (
                  <li
                    key={device.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{device.name}</p>
                      <p className="text-xs text-slate-400">{device.model} · {device.serial_number}</p>
                      <p className="text-xs text-slate-400">Last seen {formatRelativeTime(device.last_seen_at)}</p>
                    </div>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                        status.badgeClass
                      )}
                    >
                      <span
                        className={clsx(
                          "h-2.5 w-2.5 rounded-full",
                          status.dotClass
                        )}
                      ></span>
                      {status.label}
                    </span>
                  </li>
                );
              })}
              {devices && devices.length === 0 ? (
                <p className="text-sm text-slate-500">No devices registered yet.</p>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
