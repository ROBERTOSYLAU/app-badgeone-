"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type AuditItem = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details?: string;
  detail?: string;
  actor?: string;
  created_at?: string;
};

type FilterKey = "1h" | "today" | "7d" | "30d" | "all";

function formatDateBR(value?: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleString("pt-BR");
  return value;
}

function translateEntity(entityType: string) {
  const map: Record<string, string> = {
    lot: "Lote",
    organization: "Organização",
    credential: "Credencial",
    user: "Usuário",
    audit: "Auditoria",
  };
  return map[entityType] || entityType;
}

function translateAction(action: string) {
  const map: Record<string, string> = {
    create: "Criação",
    update: "Atualização",
    delete: "Exclusão",
    revoke_full: "Revogação total",
    revoke_partial: "Revogação parcial",
    recover: "Recuperação",
    activate: "Ativação",
    deactivate: "Desativação",
    pause: "Pausa",
    restore: "Restauração",
  };
  return map[action] || action;
}

function getActionColor(action: string) {
  if (action.includes("delete") || action.includes("revoke")) return "#ef4444";
  if (action.includes("create") || action.includes("activate") || action.includes("restore")) return "#22c55e";
  if (action.includes("update") || action.includes("pause") || action.includes("deactivate")) return "#f59e0b";
  return "#9ca3af";
}

export default function AuditPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [items, setItems] = useState<AuditItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("1h");

  async function loadAudit() {
    setLoading(true);
    setMessage("");

    try {
      const data = await apiGet("/api/v1/audit-logs");
      setItems((data as AuditItem[]) || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar auditoria.";
      setMessage(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    loadAudit();
  }, [user, isLoading, router]);

  const filtered = useMemo(() => {
    const now = new Date().getTime();

    return items.filter((item) => {
      if (!item.created_at || filter === "all") return true;

      const time = new Date(item.created_at).getTime();
      if (Number.isNaN(time)) return true;

      const diff = now - time;
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * 60 * 60 * 1000;

      if (filter === "1h") return diff <= oneHour;
      if (filter === "today") return diff <= oneDay;
      if (filter === "7d") return diff <= oneDay * 7;
      if (filter === "30d") return diff <= oneDay * 30;

      return true;
    });
  }, [items, filter]);

  async function clearAudit() {
    const ok = window.confirm("Tem certeza que deseja limpar a auditoria?");
    if (!ok) return;

    try {
      await apiDelete("/api/v1/audit-logs");
      setMessage("Auditoria limpa com sucesso.");
      await loadAudit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao limpar auditoria.";
      setMessage(msg);
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Auditoria</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => loadAudit()}>
            Atualizar
          </button>
          <button className="btn-ghost" onClick={() => clearAudit()}>
            Limpar
          </button>
          <button className="btn-ghost" onClick={() => router.back()}>
            ← Voltar
          </button>
        </div>
      </div>

      {message && (
        <p className={message.toLowerCase().includes("erro") || message.toLowerCase().includes("falhou") ? "error" : "success"}>
          {message}
        </p>
      )}

      <section className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button className={filter === "1h" ? "btn-active" : "btn-ghost"} onClick={() => setFilter("1h")}>
            Última hora
          </button>
          <button className={filter === "today" ? "btn-active" : "btn-ghost"} onClick={() => setFilter("today")}>
            Hoje
          </button>
          <button className={filter === "7d" ? "btn-active" : "btn-ghost"} onClick={() => setFilter("7d")}>
            7 dias
          </button>
          <button className={filter === "30d" ? "btn-active" : "btn-ghost"} onClick={() => setFilter("30d")}>
            30 dias
          </button>
          <button className={filter === "all" ? "btn-active" : "btn-ghost"} onClick={() => setFilter("all")}>
            Tudo
          </button>
        </div>

        {loading ? (
          <p>Carregando auditoria...</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((item) => {
              const actionColor = getActionColor(item.action);

              return (
                <section
                  key={item.id}
                  className="card"
                  style={{
                    marginBottom: 0,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>
                        {translateEntity(item.entity_type)} ID {item.entity_id}
                      </strong>
                      <span className="muted">{formatDateBR(item.created_at)}</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: `${actionColor}20`,
                          color: actionColor,
                          border: `1px solid ${actionColor}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {translateAction(item.action)}
                      </span>

                      {item.actor ? <span className="muted">por {item.actor}</span> : null}
                    </div>

                    <div className="muted">
                      {item.details || item.detail || "Sem detalhes."}
                    </div>
                  </div>
                </section>
              );
            })}

            {!filtered.length && (
              <section className="card" style={{ marginBottom: 0 }}>
                Nenhum registro encontrado.
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
