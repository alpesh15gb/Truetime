import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { AxiosError } from "axios";

import {
  assignShift,
  createShift,
  fetchEmployees,
  fetchShifts,
  type ShiftAssignmentPayload
} from "../lib/api";
import type { Employee, Shift, ShiftCreate } from "../types";
import { formatTime } from "../utils/format";

const initialShiftForm: ShiftCreate = {
  name: "",
  start_time: "09:00",
  end_time: "18:00",
  grace_minutes: 10
};

interface AssignmentFormState extends ShiftAssignmentPayload {
  employee_code: string;
}

const initialAssignmentForm: AssignmentFormState = {
  employee_code: "",
  shift_id: 0,
  effective_from: new Date().toISOString().slice(0, 10)
};

const parseErrorMessage = (error: unknown) => {
  if (!error) return "Unexpected error";
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail ?? axiosError.message ?? "Unexpected error";
};

export const ShiftsPage = () => {
  const queryClient = useQueryClient();
  const [shiftForm, setShiftForm] = useState<ShiftCreate>(initialShiftForm);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(initialAssignmentForm);
  const [creationFeedback, setCreationFeedback] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);

  const { data: shifts, isFetching: shiftsLoading } = useQuery({
    queryKey: ["shifts"],
    queryFn: fetchShifts
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees
  });

  const createShiftMutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setCreationFeedback("Shift created successfully.");
      setShiftForm(initialShiftForm);
    },
    onError: (error) => setCreationFeedback(parseErrorMessage(error))
  });

  const assignShiftMutation = useMutation({
    mutationFn: ({ employee_code, ...payload }: AssignmentFormState) =>
      assignShift(employee_code, payload),
    onSuccess: () => {
      setAssignmentFeedback("Shift assigned successfully.");
      setAssignmentForm((prev) => ({ ...prev, shift_id: 0 }));
    },
    onError: (error) => setAssignmentFeedback(parseErrorMessage(error))
  });

  const sortedEmployees = useMemo(() => {
    return (employees ?? []).slice().sort((a, b) => a.code.localeCompare(b.code));
  }, [employees]);

  const handleShiftSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreationFeedback(null);
    await createShiftMutation.mutateAsync({
      ...shiftForm,
      grace_minutes: Number(shiftForm.grace_minutes)
    });
  };

  const handleAssignmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignmentFeedback(null);
    if (!assignmentForm.employee_code || !assignmentForm.shift_id) {
      setAssignmentFeedback("Select both an employee and shift.");
      return;
    }
    await assignShiftMutation.mutateAsync(assignmentForm);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Shift planner</h1>
          <p className="text-sm text-slate-500">
            Configure working hours and assign them to your workforce.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft lg:col-span-5">
          <header>
            <h2 className="text-lg font-semibold text-slate-800">Create shift</h2>
            <p className="text-sm text-slate-500">Define standard operating hours and grace periods.</p>
          </header>
          <form className="space-y-4" onSubmit={handleShiftSubmit}>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Name</label>
              <input
                type="text"
                value={shiftForm.name}
                onChange={(event) => setShiftForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="General shift"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Start time</label>
                <input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">End time</label>
                <input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Grace period (minutes)</label>
              <input
                type="number"
                min={0}
                value={shiftForm.grace_minutes}
                onChange={(event) =>
                  setShiftForm((prev) => ({ ...prev, grace_minutes: Number(event.target.value) }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark"
              disabled={createShiftMutation.isPending}
            >
              {createShiftMutation.isPending ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              Save shift
            </button>
            {creationFeedback ? (
              <p className="text-sm text-slate-500">{creationFeedback}</p>
            ) : null}
          </form>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft lg:col-span-7">
          <header>
            <h2 className="text-lg font-semibold text-slate-800">Assign shift</h2>
            <p className="text-sm text-slate-500">Keep employee schedules aligned with operational hours.</p>
          </header>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAssignmentSubmit}>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Employee</label>
              <select
                value={assignmentForm.employee_code}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, employee_code: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select employee</option>
                {sortedEmployees.map((employee) => (
                  <option key={employee.id} value={employee.code}>
                    {employee.code} · {employee.first_name} {employee.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Shift</label>
              <select
                value={assignmentForm.shift_id || ""}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, shift_id: Number(event.target.value) }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select shift</option>
                {(shifts ?? []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} – {shift.end_time})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Effective from</label>
              <input
                type="date"
                value={assignmentForm.effective_from}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, effective_from: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark"
                disabled={assignShiftMutation.isPending}
              >
                {assignShiftMutation.isPending ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                Assign shift
              </button>
            </div>
            {assignmentFeedback ? (
              <p className="md:col-span-2 text-sm text-slate-500">{assignmentFeedback}</p>
            ) : null}
          </form>
        </section>
      </div>

      <section className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Active shifts</h2>
            <p className="text-sm text-slate-500">Overview of configured shift templates.</p>
          </div>
          {shiftsLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin text-primary" /> : null}
        </header>
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Grace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/70">
              {(shifts ?? []).map((shift: Shift) => (
                <tr key={shift.id} className="hover:bg-primary/5">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{shift.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{shift.grace_minutes} min</td>
                </tr>
              ))}
              {shifts && shifts.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={3}>
                    No shifts created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
