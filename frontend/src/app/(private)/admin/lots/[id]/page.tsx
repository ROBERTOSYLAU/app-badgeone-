"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../../../../../lib/api";
import { logAction } from "../../../../../lib/history";

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

type ValidityMode = "days" | "months" | "range";

export default function LotDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const lotId = Number(params.id);

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editQty, setEditQty] = useState("");
  const [validityMode, setValidityMode] = useState<ValidityMode>("days");
  const [editDays, setEditDays] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editRangeStart, setEditRangeStart] = useState("");
  const [editRangeEnd, setEditRangeEnd] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet(`/api/v1/lots/${lotId}`);
      const found = data as Lot;
      setLot(found);
      // Populate edit fields
      setEditTitle(found.title || "");
      setEditQty(String(found.total_badges));
      setEditDays(String(found.issue_window_days || ""));
    } catch {
      // fallback: search in list
      try {
        const list = (await apiGet("/api/v1/lots")) as Lot[];
        const found = list.find((l) => l.id === lotId) || null;
        setLot(found);
        if (found) {
          setEditTitle(found.title || "");
          setEditQty(String(found.total_badges));
          setEditDays(String(found.issue_window_days || ""));
        }
      } catch {
        setLot(null);
      }
    } finally {
      setLoading(false);
    }
  }

  function computeDays(): number {
    if (validityMode === "days") {
      return parseInt(editDays) || 0;
    }
    if (validityMode === "months") {
      return (parseInt(editMonths) || 0) * 30;
    }
    if (validityMode === "range" && editRangeStart && editRangeEnd) {
      const start = new Date(editRangeStart);
      const end = new Date(editRangeEnd);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    }
    return 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lot) return;
    setSaving(true);
    setMessage("");

    const days = computeDays();

    try {
      await apiPatch(`/api/v1/lots/${lot.id}`, {
        title: editTitle.trim() || undefined,
        total_badges: parseInt(editQty) || undefined,
        issue_window_days: days || undefined,
      });
      logAction("Lote editado", `ID ${lot.id} · ${editTitle || `Lote ${lot.id}`}`);
      setMessage("Lote atualizado com sucesso.");
      setEditing(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar lote.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          padding: 32,
          minHeight: "100vh",
          background: "var(--bg-soft)",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Carregando...</span>
      </main>
    );
  }

  if (!lot) {
    return (
      <main
        style={{
          padding: 32,
          minHeight: "100vh",
          background: "var(--bg-soft)",
          color: "var(--text)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <p style={{ color: "var(--muted)" }}>Lote não encontrado.</p>
        <button onClick={() => router.push("/admin/lots")} style={btnGhost}>
          ← Voltar para Lotes
        </button>
      </main>
    );
  }

  const pct =
    lot.total_badges > 0
      ? Math.round((lot.issued / lot.total_badges) * 100)
      : 0;
  const color = statusColor(lot.status);

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
      {/* Header */}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: "var(--primary)",
              }}
            >
              {lot.title || `Lote ${lot.id}`}
            </h1>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: `${color}18`,
                color,
                border: `1px solid ${color}60`,
              }}
            >
              {statusLabel(lot.status)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            ID #{lot.id} ·{" "}
            <Link
              href={`/admin/organizations/${lot.organization_id}`}
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              Ver Organização #{lot.organization_id}
            </Link>
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/admin/lots")} style={btnGhost}>
            ← Lotes
          </button>
          <button
            onClick={() => {
              setEditing((v) => !v);
              setMessage("");
            }}
            style={{
              ...btnGhost,
              background: editing ? "rgba(91,45,142,0.08)" : undefined,
              color: editing ? "var(--primary)" : undefined,
              borderColor: editing ? "rgba(91,45,142,0.3)" : undefined,
            }}
          >
            {editing ? "Cancelar edição" : "Editar lote"}
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            background: message.includes("sucesso")
              ? "rgba(22,163,74,0.08)"
              : "rgba(220,38,38,0.08)",
            border: `1px solid ${message.includes("sucesso") ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
            color: message.includes("sucesso") ? "var(--success)" : "var(--danger)",
          }}
        >
          {message}
        </div>
      )}

      {/* Info cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Total de Badges", value: lot.total_badges },
          { label: "Emitidos", value: lot.issued },
          { label: "Saldo", value: lot.remaining },
          { label: "Validade (dias)", value: lot.issue_window_days || "—" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "14px 16px",
              display: "grid",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>
              {item.label}
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--primary)",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Usage progress */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>
            Utilização
          </span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{pct}%</span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--line)",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background:
                pct >= 90 ? "#DC2626" : pct >= 70 ? "#F59E0B" : "var(--accent)",
              borderRadius: 99,
              transition: "width 0.4s",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          {lot.issued} de {lot.total_badges} badges emitidos
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              margin: "0 0 16px",
              paddingBottom: 12,
              borderBottom: "1px solid var(--line)",
              color: "var(--text)",
            }}
          >
            Editar Lote
          </h2>

          <form
            onSubmit={handleSave}
            style={{ display: "grid", gap: 16 }}
          >
            {/* Title */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={labelStyle}>Título do lote</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex.: Turma Janeiro 2025"
                style={inputStyle}
              />
            </div>

            {/* Quantity */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={labelStyle}>Quantidade total de badges</label>
              <input
                type="number"
                min={lot.issued}
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                style={{ ...inputStyle, maxWidth: 180 }}
              />
              {lot.issued > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Mínimo: {lot.issued} (já emitidos)
                </span>
              )}
            </div>

            {/* Validity */}
            <div style={{ display: "grid", gap: 8 }}>
              <label style={labelStyle}>Validade</label>

              {/* Mode selector */}
              <div style={{ display: "flex", gap: 4 }}>
                {(["days", "months", "range"] as ValidityMode[]).map((m) => {
                  const labels = {
                    days: "Por dias",
                    months: "Por meses",
                    range: "Período",
                  };
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setValidityMode(m)}
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid",
                        cursor: "pointer",
                        fontWeight: validityMode === m ? 600 : 400,
                        background:
                          validityMode === m
                            ? "rgba(181,212,0,0.18)"
                            : "var(--bg-soft)",
                        color:
                          validityMode === m
                            ? "var(--primary)"
                            : "var(--muted)",
                        borderColor:
                          validityMode === m
                            ? "rgba(181,212,0,0.35)"
                            : "var(--line)",
                      }}
                    >
                      {labels[m]}
                    </button>
                  );
                })}
              </div>

              {validityMode === "days" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={editDays}
                    onChange={(e) => setEditDays(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>dias</span>
                </div>
              )}

              {validityMode === "months" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={editMonths}
                    onChange={(e) => setEditMonths(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    meses{" "}
                    {editMonths
                      ? `(≈ ${parseInt(editMonths) * 30} dias)`
                      : ""}
                  </span>
                </div>
              )}

              {validityMode === "range" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>
                      Início
                    </label>
                    <input
                      type="datetime-local"
                      value={editRangeStart}
                      onChange={(e) => setEditRangeStart(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>
                      Fim
                    </label>
                    <input
                      type="datetime-local"
                      value={editRangeEnd}
                      onChange={(e) => setEditRangeEnd(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  {editRangeStart && editRangeEnd && (
                    <span
                      style={{
                        gridColumn: "1/-1",
                        fontSize: 12,
                        color: "var(--muted)",
                      }}
                    >
                      Equivale a {computeDays()} dias de validade
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "9px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setMessage("");
                }}
                style={btnGhost}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

const btnGhost: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 7,
  cursor: "pointer",
  color: "var(--text)",
  fontWeight: 500,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--line)",
  borderRadius: 7,
  background: "var(--bg-soft)",
  color: "var(--text)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
