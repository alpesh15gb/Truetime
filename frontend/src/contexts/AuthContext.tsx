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
  establishWithToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "truetime.accessToken";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncUser = useCallback(async (authToken: string) => {
    setAuthToken(authToken);
    const profile = await fetchCurrentUser();
    setUser(profile);
  }, []);

  const establishWithToken = useCallback(
    async (accessToken: string) => {
      try {
        await syncUser(accessToken);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        }
        setToken(accessToken);
      } catch (error) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        setAuthToken(null);
        setToken(null);
        setUser(null);
        throw error;
      }
    },
    [syncUser]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    let active = true;

    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      if (active) {
        setAuthToken(null);
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }

    establishWithToken(storedToken)
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [establishWithToken]);

  const handleLogin = useCallback(
    async (credentials: LoginPayload) => {
      setLoading(true);
      try {
        const { access_token: accessToken } = await loginRequest(credentials);
        await establishWithToken(accessToken);
      } finally {
        setLoading(false);
      }
    },
    [establishWithToken]
  );

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
    () => ({
      user,
      token,
      loading,
      login: handleLogin,
      logout: handleLogout,
      createUser: handleCreateUser,
      establishWithToken
    }),
    [user, token, loading, handleLogin, handleLogout, handleCreateUser, establishWithToken]
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
