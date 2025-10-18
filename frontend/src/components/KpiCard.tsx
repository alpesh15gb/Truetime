import clsx from "clsx";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

export const KpiCard = ({ title, value, subtitle, trend }: KpiCardProps) => {
  return (
    <div className="rounded-3xl bg-white/80 p-5 shadow-card backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-semibold text-slate-800">{value}</p>
        {trend ? (
          <span
            className={clsx(
              "rounded-full px-2 py-1 text-xs font-medium",
              trend.positive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
            )}
          >
            {trend.value}
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
};
