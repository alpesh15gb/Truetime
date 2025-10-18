import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  ArrowLeftOnRectangleIcon,
  CalendarDaysIcon,
  ClockIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

import { useAuth } from "../contexts/AuthContext";

export interface NavigationItem {
  name: string;
  to: string;
  icon: (props: React.ComponentProps<"svg">) => JSX.Element;
}

const baseNavigationItems: NavigationItem[] = [
  { name: "Dashboard", to: "/", icon: HomeIcon },
  { name: "Attendance Logs", to: "/attendance", icon: ClockIcon },
  { name: "Daily Summary", to: "/summaries", icon: CalendarDaysIcon },
  { name: "Shifts", to: "/shifts", icon: AdjustmentsHorizontalIcon },
  { name: "Employees", to: "/employees", icon: UserGroupIcon }
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const NavigationLinks = ({ items }: { items: NavigationItem[] }) => (
  <nav className="mt-8 flex flex-1 flex-col gap-1">
    {items.map((item) => (
      <NavLink
        key={item.name}
        to={item.to}
        className={({ isActive }) =>
          clsx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            isActive
              ? "bg-white/80 text-primary shadow-soft"
              : "text-slate-500 hover:bg-white/60 hover:text-primary"
          )
        }
      >
        <item.icon className="h-5 w-5" />
        <span>{item.name}</span>
      </NavLink>
    ))}
  </nav>
);

export const Sidebar = ({ open = false, onClose }: SidebarProps) => {
  const { user, logout } = useAuth();

  const items = React.useMemo(() => {
    if (user?.role === "admin") {
      return [
        ...baseNavigationItems,
        { name: "Admin Console", to: "/admin", icon: ShieldCheckIcon }
      ];
    }
    return baseNavigationItems;
  }, [user]);

  return (
    <>
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose ?? (() => {})}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/50" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-200 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-200 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-72 flex-1 flex-col gap-6 bg-slate-900/95 px-6 pb-6 pt-8 text-white shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold tracking-tight">Truetime</span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg bg-white/10 p-1 text-white hover:bg-white/20"
                  >
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                  </button>
                </div>
                <NavigationLinks items={items} />
                <div className="mt-auto space-y-4 border-t border-white/20 pt-6 text-sm text-white/80">
                  <div>
                    <p className="font-semibold text-white">{user?.full_name ?? ""}</p>
                    <p className="text-xs uppercase tracking-wide text-white/60">{user?.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      onClose?.();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                    Sign out
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <div className="hidden h-full w-72 flex-col gap-6 rounded-3xl bg-slate-900/95 px-6 pb-10 pt-10 text-white shadow-2xl backdrop-blur lg:flex">
        <div>
          <span className="block text-xl font-semibold tracking-tight">Truetime</span>
          <p className="mt-2 text-sm text-slate-300">
            Monitor workforce presence in real-time.
          </p>
        </div>
        <NavigationLinks items={items} />
        <div className="mt-auto space-y-4 rounded-2xl bg-white/5 p-4 text-sm text-slate-200">
          <div>
            <p className="font-semibold text-white">{user?.full_name ?? ""}</p>
            <p className="text-xs uppercase tracking-wide text-white/60">{user?.role}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
};
