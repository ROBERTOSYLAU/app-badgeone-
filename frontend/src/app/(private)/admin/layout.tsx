"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, RequireAuth } from "../../../lib/auth-context";

function AdminSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Visão Geral", icon: "📊" },
    { href: "/admin/organizations", label: "Organizações", icon: "🏢" },
    { href: "/admin/lots", label: "Lotes", icon: "📦" },
    { href: "/admin/audit", label: "Auditoria", icon: "📋" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo">🏅</span>
        <h1>Badge One</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "active" : ""}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <p className="name">{user?.name}</p>
          <p className="org">{user?.organization_name || "Administrador"}</p>
        </div>
        <button onClick={logout}>🚪 Sair</button>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="admin-layout">
        <AdminSidebar />
        <main className="main-content">{children}</main>
      </div>
    </RequireAuth>
  );
}
