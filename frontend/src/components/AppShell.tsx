import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = ({ children }: { children?: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-white to-surface/70 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[auto,1fr]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-h-[85vh] flex-col gap-6">
          <Topbar onToggleSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 rounded-3xl bg-white/90 p-6 shadow-soft backdrop-blur">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
};
