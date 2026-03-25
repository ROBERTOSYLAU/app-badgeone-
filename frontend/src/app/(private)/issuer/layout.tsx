"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuth, useAuth } from "../../../lib/auth-context";
import { apiGet } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import { getSocket } from "../../../lib/socket";

export default function IssuerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["issuer", "admin"]}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          minHeight: "100vh",
          background: "var(--bg-soft, #F5F5F5)",
        }}
      >
        <IssuerSidebar />
        <div>{children}</div>
      </div>
    </RequireAuth>
  );
}

type LicencaStatus = {
  ativa: boolean;
  valid_until?: string;
  dias_restantes?: number;
  alerta?: boolean;
};

function IssuerSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [avisosCount, setAvisosCount] = useState(0);
  const [suporteCount, setSuporteCount] = useState(0);
  const [licenca, setLicenca] = useState<LicencaStatus | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const alertas = await apiGet("/api/v1/alertas") as Array<{ lido_emissor: boolean }>;
      setAvisosCount(alertas.filter((a) => !a.lido_emissor).length);
    } catch {}
    try {
      const tickets = await apiGet("/api/v1/suporte/tickets") as Array<{ nao_lidas: number }>;
      setSuporteCount(tickets.reduce((s, t) => s + (t.nao_lidas || 0), 0));
    } catch {}
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    apiGet("/api/v1/licenca/status")
      .then((res) => setLicenca(res as LicencaStatus))
      .catch(() => {});
  }, []);

  // Socket.io para atualizações em tempo real
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const s = getSocket(token);

    const handleNovaMensagem = () => {
      setSuporteCount((c) => c + 1);
    };
    const handleTicketAtualizado = () => {
      fetchCounts();
    };

    s.on("mensagem:nova", handleNovaMensagem);
    s.on("ticket:atendendo", handleTicketAtualizado);

    return () => {
      s.off("mensagem:nova", handleNovaMensagem);
      s.off("ticket:atendendo", handleTicketAtualizado);
    };
  }, [fetchCounts]);

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

  const licencaIcon = licenca == null ? "" : licenca.ativa
    ? (licenca.alerta ? "🟡" : "🟢")
    : "🔴";

  const navItems = [
    { href: "/issuer", label: "Visão Geral", icon: "📊" },
    { href: "/issuer/lots", label: "Meus Lotes", icon: "📦" },
    { href: "/issuer/recipients", label: "Ganhadores", icon: "👥" },
    { href: "/issuer/emit", label: "Emitir Badge", icon: "🎖️" },
    { href: "/issuer/credentials", label: "Credenciais", icon: "📋" },
    { href: "/issuer/sign", label: "Assinar Doc", icon: "✍️" },
    { href: "/issuer/planos", label: "Planos", icon: licencaIcon || "💳" },
    { href: "/issuer/avisos", label: "Avisos", icon: "🔔", badge: avisosCount },
    { href: "/issuer/suporte", label: "Suporte", icon: "💬", badge: suporteCount },
    { href: "/issuer/perfil", label: "Meu Perfil", icon: "⚙️" },
  ];

  return (
    <aside
      style={{
        width: 180,
        minHeight: "100vh",
        background: "var(--sidebar-bg, #1A3A5C)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/issuer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 4,
          textDecoration: "none",
          color: "#fff",
        }}
      >
        <span style={{ fontSize: 20 }}>🏅</span>
        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
          Badge One
        </span>
      </Link>

      {/* Organização */}
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          padding: "2px 10px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 2,
        }}
      >
        {user?.organization_name || "Organização"}
      </div>

      {/* Nav items */}
      <nav style={{ display: "grid", gap: 3 }}>
        {navItems.map((item) => {
          const active = item.href === "/issuer"
            ? pathname === "/issuer"
            : pathname === item.href || pathname.startsWith(item.href + "/");
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
                background: active ? "rgba(0,180,216,0.18)" : "transparent",
                border: `1px solid ${active ? "rgba(0,180,216,0.35)" : "transparent"}`,
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                position: "relative",
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 9,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Dark mode */}
      <button
        onClick={toggleDark}
        title={dark ? "Modo claro" : "Modo escuro"}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 6,
          padding: "5px 8px",
          cursor: "pointer",
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          alignItems: "center",
          gap: 5,
          width: "100%",
          marginTop: 2,
        }}
      >
        <span style={{ fontSize: 14 }}>{dark ? "☀️" : "🌙"}</span>
        <span style={{ fontSize: 11 }}>{dark ? "Claro" : "Escuro"}</span>
      </button>

      {/* Sair */}
      <button
        onClick={() => { logout(); router.push("/"); }}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.75)",
          borderRadius: 7,
          padding: "7px 10px",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Sair
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User info no rodapé */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>
          {user?.name || "Emissor"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
          Emissor
        </div>
      </div>
    </aside>
  );
}
