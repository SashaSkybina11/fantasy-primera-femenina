import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, authRequiredEvent, authToken } from "../services/api";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authToken.get()) { setIsLoading(false); return; }
    api.me()
      .then(({ user: loadedUser }) => setUser(loadedUser))
      .catch(() => authToken.clear())
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const endSession = () => {
      authToken.clear();
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener(authRequiredEvent, endSession);
    return () => window.removeEventListener(authRequiredEvent, endSession);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: async (payload) => { const result = await api.login(payload); authToken.set(result.token); setUser(result.user); },
    register: async (payload) => { const result = await api.register(payload); authToken.set(result.token); setUser(result.user); },
    logout: async () => { try { await api.logout(); } finally { authToken.clear(); setUser(null); } },
    setUser,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
