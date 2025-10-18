import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

interface RequireRoleProps {
  roles: Array<"admin" | "manager" | "viewer">;
  fallback?: ReactNode;
  children: ReactNode;
}

export const RequireRole = ({ roles, fallback = <Navigate to="/" replace />, children }: RequireRoleProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Checking permissions…
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
