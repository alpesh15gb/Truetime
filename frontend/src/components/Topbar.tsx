import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../contexts/AuthContext";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar = ({ onToggleSidebar }: TopbarProps) => {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  return (
    <header className="flex items-center justify-between gap-4 rounded-3xl bg-white/80 px-6 py-4 shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-card transition hover:bg-primary-dark lg:hidden"
          onClick={onToggleSidebar}
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Today</p>
          <p className="text-lg font-semibold text-slate-700">{today}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-primary/40 hover:text-primary"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary"></span>
        </button>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {user?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{user?.full_name ?? ""}</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">{user?.role ?? ""}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
