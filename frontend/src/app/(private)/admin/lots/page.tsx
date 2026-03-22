"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  status: string;
  total_badges: number;
  issued: number;
  remaining: number;
  issue_window_days: number;
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    paused: "Pausado",
    revoked: "Revogado",
    finished: "Finalizado",
    trashed: "Lixeira",
  };
  return map[s] || s;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    active: "#16A34A",
    inactive: "#F59E0B",
    paused: "#F59E0B",
    revoked: "#DC2626",
    finished: "#6B7280",
    trashed: "#9CA3AF",
  };
  return map[s] || "#9CA3AF";
}

export default function AdminLotsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }
    loadLots();
  }, [user, isLoading]);

  async function loadLots() {
    setLoading(true);
    try {
      const data = await apiGet("/api/v1/lots");
      setLots((data as Lot[]) || []);
    } catch {
      setLots([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let base = filterStatus === "all" ? lots : lots.filter((l) => l.status === filterStatus);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) =>
      [l.title, String(l.id), String(l.organization_id), l.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [lots, filterStatus, search]);

  const tabs = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "finished", label: "Finalizados" },
  ];

  return (
    <main
      style={{
        padding: "28px 28px",
        minHeight: "100vh",
        background: "var(--bg-soft)",
        color: "var(--text)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              color: "var(--primary)",
            }}
          >
            Lotes
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            {lots.length} lotes · {lots.filter((l) => l.status === "active").length} ativos
          </p>
        </div>

        <button
          onClick={loadLots}
          style={{
            padding: "7px 14px",
            fontSize: 12,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            cursor: "pointer",
            color: "var(--text)",
            fontWeight: 500,
          }}
        >
          Atualizar
        </button>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Filter bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilterStatus(t.key)}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid transparent",
                  cursor: "pointer",
                  fontWeight: filterStatus === t.key ? 600 : 400,
                  background:
                    filterStatus === t.key
                      ? "rgba(181,212,0,0.18)"
                      : "transparent",
                  color:
                    filterStatus === t.key ? "var(--primary)" : "var(--muted)",
                  borderColor:
                    filterStatus === t.key
                      ? "rgba(181,212,0,0.35)"
                      : "transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lote..."
            style={{
              marginLeft: "auto",
              padding: "5px 10px",
              fontSize: 12,
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--bg-soft)",
              color: "var(--text)",
              outline: "none",
              width: 200,
            }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            Nenhum lote encontrado.
          </div>
        ) : (
          <div>
            {filtered.map((l, idx) => {
              const pct =
                l.total_badges > 0
                  ? Math.round((l.issued / l.total_badges) * 100)
                  : 0;
              const color = statusColor(l.status);

              return (
                <Link
                  key={l.id}
                  href={`/admin/lots/${l.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 16,
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom:
                      idx < filtered.length - 1
                        ? "1px solid var(--line)"
                        : "none",
                    textDecoration: "none",
                    color: "var(--text)",
                    transition: "background 0.15s",
                  }}
                  className="lot-row"
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--primary)",
                        }}
                      >
                        {l.title || `Lote ${l.id}`}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        #{l.id}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 12,
                        color: "var(--muted)",
                      }}
                    >
                      <span>Org #{l.organization_id}</span>
                      <span>{l.issued}/{l.total_badges} emitidos</span>
                      {l.issue_window_days > 0 && (
                        <span>Validade: {l.issue_window_days}d</span>
                      )}
                    </div>

                    <div
                      style={{
                        height: 4,
                        background: "var(--line)",
                        borderRadius: 99,
                        overflow: "hidden",
                        maxWidth: 240,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background:
                            pct >= 90
                              ? "#DC2626"
                              : pct >= 70
                              ? "#F59E0B"
                              : "var(--accent)",
                          borderRadius: 99,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${color}18`,
                      color,
                      border: `1px solid ${color}60`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusLabel(l.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`.lot-row:hover { background: rgba(91,45,142,0.04) !important; }`}</style>
    </main>
  );
}
