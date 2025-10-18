import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BoltIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  PlayCircleIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

import {
  createUser,
  deleteUser,
  executeSql,
  fetchSystemConfig,
  fetchUsers,
  runMigrations,
  updateSystemConfig,
  updateUser,
  updateUserPassword
} from "../lib/api";
import type {
  SqlQueryResult,
  SystemConfig,
  SystemConfigUpdate,
  User,
  UserCreate,
  UserRole,
  UserUpdate
} from "../types";

const initialUser: UserCreate = {
  email: "",
  full_name: "",
  password: "",
  role: "manager"
};

const toUpdatePayload = (user: User): UserUpdate => ({
  full_name: user.full_name,
  role: user.role,
  is_active: user.is_active
});

export const AdminPage = () => {
  const queryClient = useQueryClient();
  const [userForm, setUserForm] = useState<UserCreate>(initialUser);
  const [sqlStatement, setSqlStatement] = useState<string>("SELECT id, email, role, is_active FROM users ORDER BY email");
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [configDraft, setConfigDraft] = useState<SystemConfig | null>(null);
  const [userDrafts, setUserDrafts] = useState<Record<number, UserUpdate>>({});

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers
  });

  const { isLoading: configLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
    onSuccess: (config) => setConfigDraft(config)
  });

  const userMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserForm(initialUser);
      setBanner({ type: "success", message: "User account created" });
    },
    onError: (error: any) => {
      setBanner({
        type: "error",
        message: error?.response?.data?.detail ?? "Unable to create user"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserUpdate }) => updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setBanner({ type: "success", message: "User profile updated" });
    },
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "Unable to update user" });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setBanner({ type: "success", message: "User removed" });
    },
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "Unable to remove user" });
    }
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => updateUserPassword(id, password),
    onSuccess: () => setBanner({ type: "success", message: "Password updated" }),
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "Unable to update password" });
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: (payload: SystemConfigUpdate) => updateSystemConfig(payload),
    onSuccess: (config) => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      setConfigDraft(config);
      setBanner({ type: "success", message: "System configuration updated" });
    },
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "Unable to update configuration" });
    }
  });

  const migrationMutation = useMutation({
    mutationFn: runMigrations,
    onSuccess: () => setBanner({ type: "success", message: "Migrations executed" }),
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "Migration run failed" });
    }
  });

  const sqlMutation = useMutation({
    mutationFn: executeSql,
    onMutate: () => {
      setSqlResult(null);
      setBanner(null);
    },
    onSuccess: (result) => {
      setSqlResult(result);
    },
    onError: (error: any) => {
      setBanner({ type: "error", message: error?.response?.data?.detail ?? "SQL execution failed" });
    }
  });

  const handleUserSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    userMutation.mutate(userForm);
  };

  const handleConfigSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configDraft) {
      return;
    }
    const payload: SystemConfigUpdate = {
      ingestion_enabled: configDraft.ingestion_enabled,
      ingestion_poll_interval_seconds: configDraft.ingestion_poll_interval_seconds,
      ingestion_connection_timeout: configDraft.ingestion_connection_timeout,
      ingestion_force_udp: configDraft.ingestion_force_udp,
      auto_run_migrations: configDraft.auto_run_migrations
    };
    updateConfigMutation.mutate(payload);
  };

  const handleResetPassword = (user: User) => {
    const password = window.prompt(`Enter a new password for ${user.email}`);
    if (!password) {
      return;
    }
    passwordMutation.mutate({ id: user.id, password });
  };

  const stagedUsers = useMemo(() => {
    if (!users) {
      return [];
    }
    return users.map((user) => ({ ...user }));
  }, [users]);

  useEffect(() => {
    if (users) {
      const draftEntries = users.map((user) => [user.id, toUpdatePayload(user)] as const);
      setUserDrafts(Object.fromEntries(draftEntries));
    }
  }, [users]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Administrator console</h1>
          <p className="text-sm text-slate-500">
            Manage privileged accounts, runtime configuration, and database diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-primary">
          <ShieldCheckIcon className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Admins only</span>
        </div>
      </div>

      {banner ? (
        <div
          className={
            banner.type === "success"
              ? "rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          }
        >
          {banner.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleUserSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Provision account</h2>
              <p className="text-sm text-slate-500">Create administrative or manager accounts without using the CLI.</p>
            </div>
            <div className="hidden rounded-2xl bg-primary/10 p-3 text-primary lg:block">
              <WrenchScrewdriverIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Email</span>
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="admin@example.com"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Full name</span>
              <input
                required
                value={userForm.full_name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, full_name: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Jane Doe"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Password</span>
              <input
                required
                value={userForm.password}
                onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
                type="password"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-400">Role</span>
              <select
                value={userForm.role}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, role: event.target.value as UserRole }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={userMutation.isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {userMutation.isLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <BoltIcon className="h-4 w-4" />}
            Create user
          </button>
        </form>

        <form
          onSubmit={handleConfigSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">System configuration</h2>
              <p className="text-sm text-slate-500">Adjust ingestion behaviour and background workers at runtime.</p>
            </div>
            <div className="hidden rounded-2xl bg-primary/10 p-3 text-primary lg:block">
              <PlayCircleIcon className="h-6 w-6" />
            </div>
          </div>

          {configLoading || !configDraft ? (
            <p className="text-sm text-slate-500">Loading configuration…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={configDraft.ingestion_enabled}
                  onChange={(event) =>
                    setConfigDraft((prev) =>
                      prev ? { ...prev, ingestion_enabled: event.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-slate-600">Enable background ingestion</span>
              </label>
              <label className="text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-400">Poll interval (seconds)</span>
                <input
                  type="number"
                  min={5}
                  value={configDraft.ingestion_poll_interval_seconds}
                  onChange={(event) =>
                    setConfigDraft((prev) =>
                      prev
                        ? { ...prev, ingestion_poll_interval_seconds: Number(event.target.value) }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-400">Connection timeout</span>
                <input
                  type="number"
                  min={1}
                  value={configDraft.ingestion_connection_timeout}
                  onChange={(event) =>
                    setConfigDraft((prev) =>
                      prev ? { ...prev, ingestion_connection_timeout: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={configDraft.ingestion_force_udp}
                  onChange={(event) =>
                    setConfigDraft((prev) =>
                      prev ? { ...prev, ingestion_force_udp: event.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-slate-600">Force UDP transport</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={configDraft.auto_run_migrations}
                  onChange={(event) =>
                    setConfigDraft((prev) =>
                      prev ? { ...prev, auto_run_migrations: event.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-slate-600">Run migrations on startup</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={updateConfigMutation.isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {updateConfigMutation.isLoading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <WrenchScrewdriverIcon className="h-4 w-4" />
            )}
            Save configuration
          </button>
          <button
            type="button"
            onClick={() => migrationMutation.mutate()}
            disabled={migrationMutation.isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {migrationMutation.isLoading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircleIcon className="h-4 w-4" />
            )}
            Run migrations now
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Existing users</h2>
              <p className="text-sm text-slate-500">Adjust permissions, toggle access, or reset passwords.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Active</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stagedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  stagedUsers.map((user) => {
                    const draft = userDrafts[user.id] ?? toUpdatePayload(user);
                    return (
                      <tr key={user.id} className="bg-white">
                        <td className="px-3 py-2 font-medium text-slate-700">{user.email}</td>
                        <td className="px-3 py-2">
                          <select
                            value={draft.role ?? user.role}
                            onChange={(event) => {
                              const nextRole = event.target.value as UserRole;
                              setUserDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...draft, role: nextRole }
                              }));
                              updateUserMutation.mutate({
                                id: user.id,
                                payload: { ...draft, role: nextRole }
                              });
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={draft.is_active ?? user.is_active}
                            onChange={(event) => {
                              const nextActive = event.target.checked;
                              setUserDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...draft, is_active: nextActive }
                              }));
                              updateUserMutation.mutate({
                                id: user.id,
                                payload: { ...draft, is_active: nextActive }
                              });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
                            >
                              Reset password
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="inline-flex items-center rounded-xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">SQL diagnostics</h2>
              <p className="text-sm text-slate-500">Run read-only queries for troubleshooting the live database.</p>
            </div>
          </div>
          <textarea
            value={sqlStatement}
            onChange={(event) => setSqlStatement(event.target.value)}
            className="min-h-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => sqlMutation.mutate({ statement: sqlStatement })}
              disabled={sqlMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sqlMutation.isLoading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <BoltIcon className="h-4 w-4" />
              )}
              Execute query
            </button>
            <p className="text-xs text-slate-500">Only SELECT statements are permitted.</p>
          </div>
          {sqlResult ? (
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {sqlResult.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sqlResult.rows.length === 0 ? (
                    <tr>
                      <td colSpan={sqlResult.columns.length} className="px-3 py-4 text-center text-slate-500">
                        No rows returned.
                      </td>
                    </tr>
                  ) : (
                    sqlResult.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((value, columnIndex) => (
                          <td key={columnIndex} className="px-3 py-2 text-slate-700">
                            {value === null || value === undefined ? "—" : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
