"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../../lib/api";

type AuditLog = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string;
  actor: string;
  created_at: string;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [clearing, setClearing] = useState(false);

  async function loadLogs() {
    try {
      const data = await apiGet("/api/v1/audit-logs?limit=100");
      setLogs(data);
    } catch {
      console.error("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  async function clearLogs(period: string) {
    if (!confirm(`Tem certeza que deseja limpar o histórico de ${period}?`)) return;
    setClearing(true);
    try {
      await apiPost("/api/v1/audit-logs/clear", { period });
      loadLogs();
    } catch {
      alert("Erro ao limpar histórico");
    } finally {
      setClearing(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.entity_type === filter;
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  }

  function translateAction(action: string): string {
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

  function getActionIcon(action: string) {
    if (action.includes("create")) return "➕";
    if (action.includes("update")) return "✏️";
    if (action.includes("delete")) return "🗑️";
    if (action.includes("revoke")) return "🚫";
    if (action.includes("recover")) return "♻️";
    return "📝";
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="header-row">
        <h1>Auditoria</h1>
      </div>

      {/* Botões de limpar histórico */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>🧹 Limpar Histórico</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => clearLogs("hora")} disabled={clearing} style={{ width: "auto", fontSize: 12 }}>
            Última Hora
          </button>
          <button className="btn-ghost" onClick={() => clearLogs("dia")} disabled={clearing} style={{ width: "auto", fontSize: 12 }}>
            Hoje
          </button>
          <button className="btn-ghost" onClick={() => clearLogs("semana")} disabled={clearing} style={{ width: "auto", fontSize: 12 }}>
            Esta Semana
          </button>
          <button className="btn-ghost" onClick={() => clearLogs("mes")} disabled={clearing} style={{ width: "auto", fontSize: 12 }}>
            Este Mês
          </button>
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            className={filter === "all" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("all")}
            style={{ width: "auto", fontSize: 12 }}
          >
            Todos
          </button>
          <button
            className={filter === "organization" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("organization")}
            style={{ width: "auto", fontSize: 12 }}
          >
            Organizações
          </button>
          <button
            className={filter === "lot" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("lot")}
            style={{ width: "auto", fontSize: 12 }}
          >
            Lotes
          </button>
          <button
            className={filter === "credential" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("credential")}
            style={{ width: "auto", fontSize: 12 }}
          >
            Credenciais
          </button>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>Nenhum registro de auditoria</h3>
            <p>As ações realizadas no sistema aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="list">
            {filteredLogs.map((log) => (
              <li key={log.id}>
                <span style={{ marginRight: 8 }}>{getActionIcon(log.action)}</span>
                <strong>{translateAction(log.action)}</strong> em{" "}
                <span className="badge">{log.entity_type === "organization" ? "Organização" : log.entity_type === "lot" ? "Lote" : "Credencial"}</span> #{log.entity_id}
                <br />
                <span className="muted">
                  {formatDate(log.created_at)} | Por: {log.actor || "Sistema"}
                </span>
                {log.details && (
                  <p style={{ marginTop: 4, fontSize: 13 }}>{log.details}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
