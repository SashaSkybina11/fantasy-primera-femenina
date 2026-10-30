import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, authRequiredEvent, authToken, cachedAuthUser } from "../services/api";
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
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(() => authToken.get() ? cachedAuthUser.get() : null);
  const [isLoading, setIsLoading] = useState(() => Boolean(authToken.get() && !cachedAuthUser.get()));

  const updateUser = (nextUser: User | null) => {
    if (nextUser) cachedAuthUser.set(nextUser);
    else cachedAuthUser.clear();
    setUserState(nextUser);
  };

  useEffect(() => {
    const token = authToken.get();
    if (!token) { cachedAuthUser.clear(); setUserState(null); setIsLoading(false); return; }
    let active = true;
    setIsLoading(!cachedAuthUser.get());
    api.me()
      .then(({ user: loadedUser }) => {
        if (active && authToken.get() === token) updateUser(loadedUser);
      })
      // Unauthorized responses are handled by the API. Network failures must
      // not erase a valid session or a newer login.
      .catch(() => {})
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [queryClient]);

  useEffect(() => {
    const endSession = () => {
      authToken.clear();
      cachedAuthUser.clear();
      queryClient.clear();
      setUserState(null);
      setIsLoading(false);
    };
    window.addEventListener(authRequiredEvent, endSession);
    return () => window.removeEventListener(authRequiredEvent, endSession);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: async (payload) => { const result = await api.login(payload); authToken.set(result.token); cachedAuthUser.set(result.user); queryClient.clear(); setUserState(result.user); },
    register: async (payload) => { const result = await api.register(payload); authToken.set(result.token); cachedAuthUser.set(result.user); queryClient.clear(); setUserState(result.user); },
    logout: async () => { try { await api.logout(); } finally { authToken.clear(); cachedAuthUser.clear(); queryClient.clear(); setUserState(null); } },
    setUser: updateUser,
  }), [user, isLoading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
