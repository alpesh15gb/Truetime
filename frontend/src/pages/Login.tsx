import { isAxiosError } from "axios";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import {
  createInitialAdmin,
  fetchSetupStatus,
  getApiBaseUrl,
  setApiBaseUrl
} from "../lib/api";

interface SetupFormState {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, establishWithToken, user, loading } = useAuth();

  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [formState, setFormState] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const [setupForm, setSetupForm] = useState<SetupFormState>({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: ""
  });
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiUrl, setApiUrl] = useState<string>(() => getApiBaseUrl());
  const [apiConfigMessage, setApiConfigMessage] = useState<string | null>(null);

  const loadSetupStatus = useCallback(async () => {
    setCheckingSetup(true);
    try {
      const status = await fetchSetupStatus();
      setSetupRequired(!status.has_users);
      setStatusError(null);
      return true;
    } catch (err) {
      setStatusError(
        "Unable to reach the Truetime API. Confirm the backend URL below and try again."
      );
      setShowAdvanced(true);
      return false;
    } finally {
      setCheckingSetup(false);
    }
  }, []);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  if (checkingSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <span className="animate-pulse text-sm uppercase tracking-widest">Preparing Truetime…</span>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await login({ email: formState.email, password: formState.password });
      navigate("/", { replace: true });
    } catch (err) {
      setError("Invalid credentials");
    }
  };

  const handleSetupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupError(null);
    if (setupForm.password !== setupForm.confirmPassword) {
      setSetupError("Passwords do not match");
      return;
    }
    setSetupSubmitting(true);
    try {
      const response = await createInitialAdmin({
        email: setupForm.email,
        full_name: setupForm.fullName,
        password: setupForm.password
      });

      try {
        await establishWithToken(response.access_token);
        setSetupRequired(false);
        navigate("/admin", { replace: true });
        return;
      } catch (authError) {
        console.warn("Unable to auto-establish session after admin bootstrap", authError);
        setSetupRequired(false);
        setFormState({ email: setupForm.email, password: setupForm.password });
        setError("Administrator created. Please sign in with the same credentials.");
        return;
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 409) {
          setSetupError("An administrator already exists. Please sign in instead.");
          setSetupRequired(false);
        } else if (!err.response || status === 502 || status === 503 || status === 504) {
          setSetupError(
            "Unable to reach the Truetime API. Confirm your deployment URL and try again."
          );
        } else if (status === 404) {
          setSetupError(
            "The Truetime API was not found at this address. Update VITE_API_BASE_URL (or your Vercel rewrite) to point at the backend."
          );
        } else if (status === 405) {
          setSetupError(
            "The Truetime API rejected this request (405). Ensure your backend exposes POST /api/auth/initial-admin and that this app points to the correct base URL."
          );
        } else if (typeof err.response?.data?.detail === "string") {
          setSetupError(err.response.data.detail);
        } else if (typeof err.response?.data === "string") {
          setSetupError(err.response.data);
        } else {
          setSetupError("Unable to create administrator. Please try again.");
        }
      } else {
        setSetupError("Unable to create administrator. Please try again.");
      }
    } finally {
      setSetupSubmitting(false);
    }
  };

  if (setupRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
        <div className="w-full max-w-xl rounded-3xl bg-white p-10 shadow-xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">Welcome to Truetime</h1>
            <p className="mt-2 text-sm text-slate-500">
              Create the first administrator account to finish setup.
            </p>
            {statusError ? <p className="mt-2 text-xs text-red-500">{statusError}</p> : null}
          </div>
          <form className="space-y-5" onSubmit={handleSetupSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="setup-email">
                  Work email
                </label>
                <input
                  id="setup-email"
                  type="email"
                  required
                  value={setupForm.email}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, email: event.target.value.trim() }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="you@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="setup-name">
                  Full name
                </label>
                <input
                  id="setup-name"
                  type="text"
                  required
                  value={setupForm.fullName}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, fullName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="setup-password">
                  Password
                </label>
                <input
                  id="setup-password"
                  type="password"
                  required
                  value={setupForm.password}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="setup-confirm">
                  Confirm password
                </label>
                <input
                  id="setup-confirm"
                  type="password"
                  required
                  value={setupForm.confirmPassword}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {setupError ? <p className="text-sm text-red-500">{setupError}</p> : null}
            <button
              type="submit"
              disabled={setupSubmitting || loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {setupSubmitting || loading ? "Creating administrator…" : "Create administrator"}
            </button>
          </form>
          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <button
              type="button"
              className="text-primary transition hover:text-primary-dark"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide backend settings" : "Can't reach your API? Configure backend URL"}
            </button>
            {showAdvanced ? (
              <form
                className="mt-4 space-y-4 rounded-2xl border border-slate-200 p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setApiConfigMessage(null);
                  const nextUrl = setApiBaseUrl(apiUrl);
                  setApiUrl(nextUrl);
                  const success = await loadSetupStatus();
                  setApiConfigMessage(
                    success
                      ? "Backend URL saved. Try creating the administrator again."
                      : "Still unable to reach the API. Check the address and network access."
                  );
                }}
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="api-url">
                    Backend API URL
                  </label>
                  <input
                    id="api-url"
                    type="url"
                    required
                    value={apiUrl}
                    onChange={(event) => setApiUrl(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="https://your-backend.example.com/api"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Save backend URL
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
                    onClick={async () => {
                      setApiConfigMessage(null);
                      const nextUrl = setApiBaseUrl(null);
                      setApiUrl(nextUrl);
                      const success = await loadSetupStatus();
                      setApiConfigMessage(
                        success
                          ? "Backend URL reset to default."
                          : "Still unable to reach the API after reset."
                      );
                    }}
                  >
                    Reset to default
                  </button>
                </div>
                {apiConfigMessage ? (
                  <p className="text-sm text-slate-600">{apiConfigMessage}</p>
                ) : null}
              </form>
            ) : null}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setSetupRequired(false)}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Sign in to Truetime</h1>
          <p className="mt-2 text-sm text-slate-500">Manage attendance securely.</p>
          {statusError ? <p className="mt-2 text-xs text-red-500">{statusError}</p> : null}
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={formState.password}
              onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Need help getting access? Contact your administrator or{' '}
          <a href="mailto:support@example.com" className="text-primary hover:underline">
            support
          </a>
          .
        </p>
      </div>
    </div>
  );
};
