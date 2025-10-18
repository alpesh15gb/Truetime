import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

import { fetchAttendanceSummaries } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatFullName, formatMinutes } from "../utils/format";
import type { AttendanceSummary } from "../types";

const todayISO = new Date().toISOString().slice(0, 10);

const sortSummaries = (items: AttendanceSummary[]) => {
  return items.slice().sort((a, b) => a.employee.code.localeCompare(b.employee.code));
};

export const SummariesPage = () => {
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  const { data, isFetching } = useQuery({
    queryKey: ["attendance-summaries", selectedDate],
    queryFn: () => fetchAttendanceSummaries(selectedDate ? { day: selectedDate } : {}),
  });

  const summaries = useMemo(() => sortSummaries(data ?? []), [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Daily attendance summary</h1>
          <p className="text-sm text-slate-500">Track presence, lateness, and total hours for every employee.</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="summary-date" className="text-xs uppercase tracking-wide text-slate-400">
            Date
          </label>
          <input
            id="summary-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/80">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">First in</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last out</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Worked</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Late</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/70">
            {summaries.map((summary) => (
              <tr key={`${summary.employee.id}-${summary.date}`} className="hover:bg-primary/5">
                <td className="px-4 py-3 text-sm font-medium text-slate-700">
                  {formatFullName(summary.employee.first_name, summary.employee.last_name)}
                  <span className="ml-2 text-xs text-slate-400">{summary.employee.code}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {summary.shift ? `${summary.shift.name}` : "Unassigned"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={summary.status} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {summary.first_in ? formatDateTime(summary.first_in, "HH:mm") : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {summary.last_out ? formatDateTime(summary.last_out, "HH:mm") : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{formatMinutes(summary.total_minutes)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {summary.late_minutes !== null && summary.late_minutes !== undefined
                    ? formatMinutes(summary.late_minutes)
                    : "—"}
                </td>
              </tr>
            ))}
            {summaries.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No attendance captured for the selected date yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {isFetching ? (
          <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-slate-500">
            <ArrowPathIcon className="h-4 w-4 animate-spin" /> Refreshing summary…
          </div>
        ) : null}
      </div>
    </div>
  );
};
