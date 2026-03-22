"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuth, useAuth } from "../../../lib/auth-context";

function AdminSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
        background: "#081748",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "sticky",
        top: 0,
      }}
    >
      <Link
        href="/admin"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "7px 10px",
          borderRadius: 8,
          textDecoration: "none",
          color: "#fff",
          fontWeight: 700,
          fontSize: 20,
        }}
      >
        <span style={{ fontSize: 22 }}>🏅</span>
        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Badge One</span>
      </Link>

      <nav style={{ display: "grid", gap: 8 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 8,
                textDecoration: "none",
                color: "#fff",
                background: active ? "rgba(37, 99, 235, 0.35)" : "transparent",
                border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "rgba(255,255,255,0.08)"}`,
                fontWeight: active ? 700 : 500,
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div>
          <div style={{ color: "#fff", fontWeight: 700 }}>
            {user?.name || "Badge One Admin"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 14 }}>
            {user?.organization_name || "Administrador"}
          </div>
        </div>

        <button
          className="btn-ghost"
          onClick={() => {
            logout();
            router.push("/");
          }}
          style={{ width: "100%" }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          minHeight: "100vh",
          background: "#03113b",
        }}
      >
        <AdminSidebar />
        <div>{children}</div>
      </div>
    </RequireAuth>
  );
}
