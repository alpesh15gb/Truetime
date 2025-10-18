import clsx from "clsx";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status.toLowerCase();
  const config = (() => {
    switch (normalized) {
      case "in":
        return { label: "Clock In", className: "bg-green-100 text-green-600" };
      case "out":
        return { label: "Clock Out", className: "bg-amber-100 text-amber-600" };
      case "present":
        return { label: "Present", className: "bg-emerald-100 text-emerald-600" };
      case "late":
        return { label: "Late", className: "bg-amber-100 text-amber-600" };
      case "absent":
        return { label: "Absent", className: "bg-rose-100 text-rose-600" };
      case "incomplete":
        return { label: "Incomplete", className: "bg-slate-200 text-slate-700" };
      default:
        return { label: status, className: "bg-slate-100 text-slate-600" };
    }
  })();

  return (
    <span className={clsx("rounded-full px-3 py-1 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
};
