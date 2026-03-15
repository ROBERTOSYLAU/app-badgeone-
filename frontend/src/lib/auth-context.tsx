"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "issuer";
  status?: "active" | "inactive";
  organization_id?: number | null;
  organization_name?: string | null;
  permissions?: string[];
};

type AuthContextType = {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isIssuer: () => boolean;
  getOrganizationId: () => number | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshSession = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/auth/me"), {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const publicPaths = ["/", "/login"];
    const isPublic = publicPaths.includes(pathname);

    if (!user && !isPublic) {
      router.push("/login");
      return;
    }

    if (user) {
      if (pathname === "/login") {
        router.push(user.role === "admin" ? "/admin" : "/issuer");
        return;
      }

      if (pathname.startsWith("/admin") && user.role !== "admin") {
        router.push("/issuer");
        return;
      }

      if (pathname.startsWith("/issuer") && user.role !== "issuer" && user.role !== "admin") {
        router.push("/login");
        return;
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await fetch(apiUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(error.detail || "Credenciais inválidas");
    }

    const data = await res.json();
    setUser(data.user);
    router.push(data.user.role === "admin" ? "/admin" : "/issuer");
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  const hasPermission = (permission: string) => {
    if (!user?.permissions) return false;
    if (user.role === "admin") return true;
    return user.permissions.includes(permission) || user.permissions.includes("admin:*");
  };

  const isAdmin = () => user?.role === "admin";
  const isIssuer = () => user?.role === "issuer";
  const getOrganizationId = () => user?.organization_id ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshSession,
        hasPermission,
        isAdmin,
        isIssuer,
        getOrganizationId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function RequireAuth({ children, allowedRoles }: { children: ReactNode; allowedRoles?: ("admin" | "issuer")[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!isLoading && isAuthenticated && allowedRoles && !allowedRoles.includes(user!.role)) {
      router.push(user!.role === "admin" ? "/admin" : "/issuer");
    }
  }, [isLoading, isAuthenticated, allowedRoles, user, router]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (allowedRoles && !allowedRoles.includes(user!.role)) return null;

  return <>{children}</>;
}
