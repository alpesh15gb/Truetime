import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowPathIcon, FunnelIcon } from "@heroicons/react/24/outline";

import { fetchAttendanceLogs } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatFullName } from "../utils/format";

const LIMIT = 25;

interface FiltersState {
  employee_code: string;
  device_serial: string;
  from: string;
  to: string;
}

const initialFilters: FiltersState = {
  employee_code: "",
  device_serial: "",
  from: "",
  to: ""
};

export const AttendancePage = () => {
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [page, setPage] = useState(0);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { limit: LIMIT, offset: page * LIMIT };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    return params;
  }, [filters, page]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["attendance", queryParams],
    queryFn: () => fetchAttendanceLogs(queryParams),
    keepPreviousData: true
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    refetch();
  };

  const handleReset = () => {
    setFilters(initialFilters);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Attendance logs</h1>
          <p className="text-sm text-slate-500">Search and filter biometric punches from every device.</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-soft md:grid-cols-5"
      >
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Employee code</label>
          <input
            type="text"
            value={filters.employee_code}
            onChange={(event) => setFilters((prev) => ({ ...prev, employee_code: event.target.value }))}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="EMP001"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Device serial</label>
          <input
            type="text"
            value={filters.device_serial}
            onChange={(event) => setFilters((prev) => ({ ...prev, device_serial: event.target.value }))}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="SN123"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">From</label>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">To</label>
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-end gap-3 md:col-span-1">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark"
          >
            <FunnelIcon className="h-4 w-4" /> Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary hover:text-primary"
          >
            Clear
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/70">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Log ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Device</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Direction</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/70">
            {data?.items.map((log) => (
              <tr key={log.id} className="hover:bg-primary/5">
                <td className="px-4 py-3 text-sm text-slate-500">{log.external_id ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">
                  {formatFullName(log.employee.first_name, log.employee.last_name)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{log.employee.department ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {log.device.name} · {log.device.serial_number}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={log.direction} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(log.punched_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isFetching ? (
          <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-slate-500">
            <ArrowPathIcon className="h-4 w-4 animate-spin" /> Loading latest results...
          </div>
        ) : null}
        {data && data.items.length === 0 && !isFetching ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">No logs match your filters yet.</div>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white/80 px-4 py-3 text-sm text-slate-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              className="rounded-2xl border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-2xl border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
