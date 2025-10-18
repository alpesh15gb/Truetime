import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedLayout } from "./components/ProtectedLayout";
import { RequireRole } from "./components/RequireRole";
import { AdminPage } from "./pages/Admin";
import { AttendancePage } from "./pages/Attendance";
import { DashboardPage } from "./pages/Dashboard";
import { EmployeesPage } from "./pages/Employees";
import { LoginPage } from "./pages/Login";
import { ShiftsPage } from "./pages/Shifts";
import { SummariesPage } from "./pages/Summaries";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "attendance", element: <AttendancePage /> },
      { path: "summaries", element: <SummariesPage /> },
      { path: "shifts", element: <ShiftsPage /> },
      { path: "employees", element: <EmployeesPage /> },
      {
        path: "admin",
        element: (
          <RequireRole roles={["admin"]}>
            <AdminPage />
          </RequireRole>
        )
      },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);
