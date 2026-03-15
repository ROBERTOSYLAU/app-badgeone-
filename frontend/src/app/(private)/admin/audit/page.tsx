"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../../lib/api";

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

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.entity_type === filter;
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
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

      <section className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            className={filter === "all" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          <button
            className={filter === "organization" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("organization")}
          >
            Organizações
          </button>
          <button
            className={filter === "lot" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("lot")}
          >
            Lotes
          </button>
          <button
            className={filter === "credential" ? "btn-active" : "btn-ghost"}
            onClick={() => setFilter("credential")}
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
                <strong>{log.action}</strong> em{" "}
                <span className="badge">{log.entity_type}</span> #{log.entity_id}
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
