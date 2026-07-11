import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";

export interface LCUser {
  id: number;
  username: string;
  role: string;
  displayName?: string | null;
}

interface AuthState {
  user: LCUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, orgCode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    fetch("/api/trpc/auth.me", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then((data: any) => {
        const u = data?.result?.data?.json;
        if (u && ["superadmin", "admin"].includes(u.role)) {
          setState({ user: u, loading: false, error: null });
        } else {
          setState({ user: null, loading: false, error: null });
        }
      })
      .catch(() => setState({ user: null, loading: false, error: null }));
  }, []);

  const login = useCallback(async (username: string, password: string, orgCode: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const body = JSON.stringify({ "0": { json: { username, password, orgCode } } });
      const res = await fetch("/api/trpc/auth.login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      const result = data?.[0]?.result?.data?.json ?? data?.result?.data?.json;
      if (!result) throw new Error("بيانات خاطئة");
      if (!["superadmin", "admin"].includes(result.role)) {
        throw new Error("هذا البرنامج مخصص للمدير العام فقط");
      }
      setState({ user: result, loading: false, error: null });
      queryClient.invalidateQueries();
    } catch (err: any) {
      setState({ user: null, loading: false, error: err.message ?? "خطأ في تسجيل الدخول" });
      throw err;
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    await fetch("/api/trpc/auth.logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
    setState({ user: null, loading: false, error: null });
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
