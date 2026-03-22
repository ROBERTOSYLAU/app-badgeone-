"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuth, useAuth } from "../../../lib/auth-context";

function AdminSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  const navItems = [
    { href: "/admin", label: "Visão Geral", icon: "📊" },
    { href: "/admin/organizations", label: "Organizações", icon: "🏢" },
    { href: "/admin/lots", label: "Lotes", icon: "📦" },
    { href: "/admin/audit", label: "Auditoria", icon: "📋" },
  ];

  return (
    <aside
      style={{
        width: 180,
        minHeight: "100vh",
        background: "var(--sidebar-bg, #3D1F6E)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "sticky",
        top: 0,
      }}
    >
      <Link
        href="/admin"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 6,
          textDecoration: "none",
          color: "#fff",
        }}
      >
        <span style={{ fontSize: 20 }}>🏅</span>
        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>Badge One</span>
      </Link>

      <nav style={{ display: "grid", gap: 3 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 10px",
                borderRadius: 7,
                textDecoration: "none",
                color: active ? "#fff" : "rgba(255,255,255,0.68)",
                background: active ? "rgba(181,212,0,0.18)" : "transparent",
                border: `1px solid ${active ? "rgba(181,212,0,0.35)" : "transparent"}`,
                fontWeight: active ? 600 : 400,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
            {user?.name || "Badge One Admin"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
            {user?.organization_name || "Administrador"}
          </div>
        </div>

        <button
          onClick={toggleDark}
          title={dark ? "Modo claro" : "Modo escuro"}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            borderRadius: 7,
            padding: "6px 10px",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{dark ? "☀️" : "🌙"}</span>
          <span>{dark ? "Modo Claro" : "Modo Escuro"}</span>
        </button>

        <button
          onClick={() => { logout(); router.push("/"); }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.8)",
            borderRadius: 7,
            padding: "7px 10px",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          minHeight: "100vh",
          background: "var(--bg-soft, #F5F5F5)",
        }}
      >
        <AdminSidebar />
        <div>{children}</div>
      </div>
    </RequireAuth>
  );
}
