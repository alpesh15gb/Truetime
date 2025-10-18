import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  createUser,
  fetchCurrentUser,
  loginRequest,
  setAuthToken
} from "../lib/api";
import type { LoginPayload, User, UserCreate } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => void;
  createUser: (payload: UserCreate) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "truetime.accessToken";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncUser = useCallback(async (authToken: string) => {
    setAuthToken(authToken);
    const profile = await fetchCurrentUser();
    setUser(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!token) {
        setAuthToken(null);
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        await syncUser(token);
      } catch (error) {
        if (!cancelled) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
          setAuthToken(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize().catch(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token, syncUser]);

  const handleLogin = useCallback(async (credentials: LoginPayload) => {
    setLoading(true);
    try {
      const { access_token: accessToken } = await loginRequest(credentials);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, []);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }, []);

  const handleCreateUser = useCallback(
    async (payload: UserCreate) => {
      const created = await createUser(payload);
      return created;
    },
    []
  );

  const value = useMemo(
    () => ({ user, token, loading, login: handleLogin, logout: handleLogout, createUser: handleCreateUser }),
    [user, token, loading, handleLogin, handleLogout, handleCreateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
