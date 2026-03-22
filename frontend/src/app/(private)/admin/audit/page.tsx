"use client";

import { useEffect, useState } from "react";
import { getHistory, clearHistory, HistoryEntry } from "../../../../lib/history";
import { useConfirm } from "../../../../lib/confirm-modal";

export default function HistoricoPage() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");

  function load() {
    setEntries(getHistory());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleClear() {
    const ok = await confirm("Apagar todo o histórico de ações?", { danger: true, confirmText: "Apagar tudo" });
    if (!ok) return;
    clearHistory();
    setEntries([]);
  }

  function formatTs(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      e.action.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q)
    );
  });

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
            Histórico
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            {entries.length} registros armazenados localmente
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={load}
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
          <button
            onClick={handleClear}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: 7,
              cursor: "pointer",
              color: "var(--danger)",
              fontWeight: 500,
            }}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por ação ou detalhe..."
            style={{
              width: "100%",
              padding: "7px 12px",
              fontSize: 13,
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--bg-soft)",
              color: "var(--text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            {entries.length === 0
              ? "Nenhuma ação registrada ainda."
              : "Nenhum resultado encontrado."}
          </div>
        ) : (
          <div>
            {filtered.map((e, idx) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom:
                    idx < filtered.length - 1
                      ? "1px solid var(--line)"
                      : "none",
                  background:
                    idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTs(e.timestamp)}
                </span>

                <div style={{ display: "grid", gap: 1 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--primary)",
                    }}
                  >
                    {e.action}
                  </span>
                  {e.detail && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {e.detail}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    opacity: 0.5,
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{e.id.slice(-6)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
