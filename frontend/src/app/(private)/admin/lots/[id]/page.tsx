"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "../../../../../lib/api";
import { logAction } from "../../../../../lib/history";

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  description?: string;
  status: string;
  total_badges: number;
  issued: number;
  remaining: number;
  issue_window_days: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
};

type Org = { id: number; name: string; status: string };

type ValidityMode = "days" | "months" | "range";

function statusLabel(s: string) {
  const map: Record<string, string> = {
    active: "Ativo", inactive: "Inativo", paused: "Pausado",
    revoked: "Revogado", finished: "Finalizado", trashed: "Lixeira",
  };
  return map[s] || s;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    active: "#16A34A", inactive: "#F59E0B", paused: "#F59E0B",
    revoked: "#DC2626", finished: "#6B7280", trashed: "#9CA3AF",
  };
  return map[s] || "#9CA3AF";
}

function fmtDt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// Convert ISO datetime to datetime-local value (YYYY-MM-DDTHH:MM)
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

export default function LotDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const lotId = Number(params.id);

  const [lot, setLot] = useState<Lot | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showCreateLot, setShowCreateLot] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editQty, setEditQty] = useState("");
  const [validityMode, setValidityMode] = useState<ValidityMode>("days");
  const [editDays, setEditDays] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editRangeStart, setEditRangeStart] = useState("");
  const [editRangeEnd, setEditRangeEnd] = useState("");

  // Create new lot form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newValidityMode, setNewValidityMode] = useState<ValidityMode>("days");
  const [newDays, setNewDays] = useState("365");
  const [newMonths, setNewMonths] = useState("");
  const [newRangeStart, setNewRangeStart] = useState("");
  const [newRangeEnd, setNewRangeEnd] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const list = (await apiGet("/api/v1/lots")) as Lot[];
      const found = list.find((l) => l.id === lotId) || null;
      setLot(found);

      if (found) {
        populateEdit(found);
        // Load org name
        try {
          const orgs = (await apiGet("/api/v1/organizations")) as Org[];
          setOrg(orgs.find((o) => o.id === found.organization_id) || null);
        } catch { setOrg(null); }
      }
    } catch {
      setLot(null);
    } finally {
      setLoading(false);
    }
  }

  function populateEdit(l: Lot) {
    setEditTitle(l.title || "");
    setEditDesc(l.description || "");
    setEditQty(String(l.total_badges));
    if (l.start_date && l.end_date) {
      setValidityMode("range");
      setEditRangeStart(toLocalInput(l.start_date));
      setEditRangeEnd(toLocalInput(l.end_date));
      setEditDays(String(l.issue_window_days));
    } else {
      setValidityMode("days");
      setEditDays(String(l.issue_window_days || ""));
      setEditRangeStart("");
      setEditRangeEnd("");
    }
    setEditMonths("");
  }

  function computeDays(mode: ValidityMode, days: string, months: string, rs: string, re: string): number {
    if (mode === "days") return parseInt(days) || 0;
    if (mode === "months") return (parseInt(months) || 0) * 30;
    if (mode === "range" && rs && re) {
      const diff = Math.ceil((new Date(re).getTime() - new Date(rs).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    }
    return 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lot) return;
    setSaving(true);
    setMessage("");
    const days = computeDays(validityMode, editDays, editMonths, editRangeStart, editRangeEnd);
    try {
      await apiPatch(`/api/v1/lots/${lot.id}`, {
        title: editTitle.trim() || undefined,
        description: editDesc.trim() || undefined,
        total_badges: parseInt(editQty) || undefined,
        issue_window_days: days || undefined,
        start_date: validityMode === "range" ? editRangeStart || undefined : null,
        end_date: validityMode === "range" ? editRangeEnd || undefined : null,
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

  function computeNewDays() {
    return computeDays(newValidityMode, newDays, newMonths, newRangeStart, newRangeEnd);
  }

  async function handleCreateLot(e: React.FormEvent) {
    e.preventDefault();
    if (!lot) return;
    const days = computeNewDays();
    if (!parseInt(newQty) || parseInt(newQty) <= 0) { setMessage("Quantidade deve ser maior que 0."); return; }
    if (!days || days <= 0) { setMessage("Informe uma validade maior que zero."); return; }
    setSaving(true);
    setMessage("");
    try {
      await apiPost("/api/v1/lots", {
        organization_id: lot.organization_id,
        title: newTitle.trim() || undefined,
        description: newDesc.trim() || undefined,
        total_badges: parseInt(newQty),
        issue_window_days: days,
        start_date: newValidityMode === "range" ? newRangeStart || undefined : undefined,
        end_date: newValidityMode === "range" ? newRangeEnd || undefined : undefined,
      });
      logAction("Lote criado", `Org #${lot.organization_id} · ${newTitle || "Sem título"}`);
      setMessage("Lote criado com sucesso.");
      setShowCreateLot(false);
      setNewTitle(""); setNewDesc(""); setNewQty("");
      setNewDays("365"); setNewMonths(""); setNewRangeStart(""); setNewRangeEnd("");
      router.push(`/admin/organizations/${lot.organization_id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar lote.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={page}>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Carregando...</span>
      </main>
    );
  }

  if (!lot) {
    return (
      <main style={page}>
        <p style={{ color: "var(--muted)" }}>Lote não encontrado.</p>
        <button onClick={() => router.push("/admin/lots")} style={btnGhost}>← Voltar para Lotes</button>
      </main>
    );
  }

  const pct = lot.total_badges > 0 ? Math.round((lot.issued / lot.total_badges) * 100) : 0;
  const color = statusColor(lot.status);

  return (
    <main style={page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--primary)" }}>
              {lot.title || `Lote #${lot.id}`}
            </h1>
            <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}60` }}>
              {statusLabel(lot.status)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>ID #{lot.id}</span>
            <span>·</span>
            {org ? (
              <Link href={`/admin/organizations/${lot.organization_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                {org.name}
              </Link>
            ) : (
              <Link href={`/admin/organizations/${lot.organization_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                Organização #{lot.organization_id}
              </Link>
            )}
            {lot.created_at && <><span>·</span><span>Criado em {fmtDt(lot.created_at)}</span></>}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin/lots")} style={btnGhost}>← Lotes</button>
          <button
            onClick={() => { setShowCreateLot((v) => !v); setEditing(false); setMessage(""); }}
            style={{ ...btnGhost, ...(showCreateLot ? { background: "rgba(181,212,0,0.12)", color: "var(--primary)", borderColor: "rgba(181,212,0,0.4)" } : {}) }}
          >
            + Criar Lote
          </button>
          <button
            onClick={() => { setEditing((v) => !v); setShowCreateLot(false); setMessage(""); if (!editing && lot) populateEdit(lot); }}
            style={{ ...btnGhost, ...(editing ? { background: "rgba(91,45,142,0.08)", color: "var(--primary)", borderColor: "rgba(91,45,142,0.3)" } : {}) }}
          >
            {editing ? "Cancelar edição" : "Editar lote"}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16,
          background: message.includes("sucesso") ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
          border: `1px solid ${message.includes("sucesso") ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
          color: message.includes("sucesso") ? "var(--success)" : "var(--danger)",
        }}>
          {message}
        </div>
      )}

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total de Badges", value: lot.total_badges },
          { label: "Emitidos", value: lot.issued },
          { label: "Saldo", value: lot.remaining },
          { label: "Validade (dias)", value: lot.issue_window_days || "—" },
        ].map((item) => (
          <div key={item.label} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, display: "block", marginBottom: 4 }}>{item.label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Date info */}
      {(lot.start_date || lot.end_date || lot.description) && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "grid", gap: 8 }}>
          {lot.description && (
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Descrição: </span>{lot.description}
            </div>
          )}
          {lot.start_date && (
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Prazo início: </span>{fmtDt(lot.start_date)}
            </div>
          )}
          {lot.end_date && (
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Prazo fim: </span>{fmtDt(lot.end_date)}
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Utilização</span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#DC2626" : pct >= 70 ? "#F59E0B" : "var(--accent)", borderRadius: 99, transition: "width 0.4s" }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>{lot.issued} de {lot.total_badges} badges emitidos</div>
      </div>

      {/* Edit form */}
      {editing && (
        <LotForm
          title="Editar Lote"
          lotTitle={editTitle} setLotTitle={setEditTitle}
          lotDesc={editDesc} setLotDesc={setEditDesc}
          lotQty={editQty} setLotQty={setEditQty}
          issuedMin={lot.issued}
          validityMode={validityMode} setValidityMode={setValidityMode}
          days={editDays} setDays={setEditDays}
          months={editMonths} setMonths={setEditMonths}
          rangeStart={editRangeStart} setRangeStart={setEditRangeStart}
          rangeEnd={editRangeEnd} setRangeEnd={setEditRangeEnd}
          computeDaysResult={computeDays(validityMode, editDays, editMonths, editRangeStart, editRangeEnd)}
          saving={saving}
          onSubmit={handleSave}
          onCancel={() => { setEditing(false); setMessage(""); }}
          submitLabel="Salvar alterações"
        />
      )}

      {/* Create lot form */}
      {showCreateLot && (
        <LotForm
          title={`Novo Lote — ${org?.name || `Org #${lot.organization_id}`}`}
          lotTitle={newTitle} setLotTitle={setNewTitle}
          lotDesc={newDesc} setLotDesc={setNewDesc}
          lotQty={newQty} setLotQty={setNewQty}
          issuedMin={0}
          validityMode={newValidityMode} setValidityMode={setNewValidityMode}
          days={newDays} setDays={setNewDays}
          months={newMonths} setMonths={setNewMonths}
          rangeStart={newRangeStart} setRangeStart={setNewRangeStart}
          rangeEnd={newRangeEnd} setRangeEnd={setNewRangeEnd}
          computeDaysResult={computeNewDays()}
          saving={saving}
          onSubmit={handleCreateLot}
          onCancel={() => { setShowCreateLot(false); setMessage(""); }}
          submitLabel="Criar Lote"
        />
      )}
    </main>
  );
}

/* ── Shared lot form component ── */
function LotForm({
  title, lotTitle, setLotTitle, lotDesc, setLotDesc,
  lotQty, setLotQty, issuedMin,
  validityMode, setValidityMode,
  days, setDays, months, setMonths,
  rangeStart, setRangeStart, rangeEnd, setRangeEnd,
  computeDaysResult, saving, onSubmit, onCancel, submitLabel,
}: {
  title: string;
  lotTitle: string; setLotTitle: (v: string) => void;
  lotDesc: string; setLotDesc: (v: string) => void;
  lotQty: string; setLotQty: (v: string) => void;
  issuedMin: number;
  validityMode: ValidityMode; setValidityMode: (v: ValidityMode) => void;
  days: string; setDays: (v: string) => void;
  months: string; setMonths: (v: string) => void;
  rangeStart: string; setRangeStart: (v: string) => void;
  rangeEnd: string; setRangeEnd: (v: string) => void;
  computeDaysResult: number;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid var(--line)", color: "var(--text)" }}>
        {title}
      </h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        {/* Title + Description */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Título do lote</label>
            <input value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Ex.: Turma Janeiro 2025" style={inp} />
          </div>
          <div>
            <label style={lbl}>Descrição (opcional)</label>
            <input value={lotDesc} onChange={(e) => setLotDesc(e.target.value)} placeholder="Opcional" style={inp} />
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label style={lbl}>Quantidade total de badges</label>
          <input type="number" min={issuedMin || 1} value={lotQty} onChange={(e) => setLotQty(e.target.value)} placeholder="100" style={{ ...inp, maxWidth: 160 }} />
          {issuedMin > 0 && <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 3 }}>Mínimo: {issuedMin} (já emitidos)</span>}
        </div>

        {/* Validity mode */}
        <div>
          <label style={lbl}>Validade</label>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {(["days", "months", "range"] as ValidityMode[]).map((m) => {
              const labels = { days: "Dias", months: "Meses", range: "Período (início/fim)" };
              return (
                <button key={m} type="button" onClick={() => setValidityMode(m)} style={{
                  padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "1px solid", cursor: "pointer",
                  fontWeight: validityMode === m ? 600 : 400,
                  background: validityMode === m ? "rgba(181,212,0,0.15)" : "var(--bg-soft)",
                  color: validityMode === m ? "var(--primary)" : "var(--muted)",
                  borderColor: validityMode === m ? "rgba(181,212,0,0.4)" : "var(--line)",
                }}>
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {validityMode === "days" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="365" style={{ ...inp, maxWidth: 120 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>dias</span>
            </div>
          )}

          {validityMode === "months" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} placeholder="12" style={{ ...inp, maxWidth: 120 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                meses{months ? ` (≈ ${parseInt(months) * 30} dias)` : ""}
              </span>
            </div>
          )}

          {validityMode === "range" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Prazo de início</label>
                <input type="datetime-local" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Prazo de fim</label>
                <input type="datetime-local" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={inp} />
              </div>
              {rangeStart && rangeEnd && (
                <span style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)" }}>
                  Equivale a <strong>{computeDaysResult}</strong> dias de validade
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button type="submit" disabled={saving} style={{
            padding: "9px 20px", fontSize: 13, fontWeight: 600,
            background: "var(--primary)", color: "#fff", border: "none",
            borderRadius: 7, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Salvando..." : submitLabel}
          </button>
          <button type="button" onClick={onCancel} style={btnGhost}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: "28px 28px", minHeight: "100vh",
  background: "var(--bg-soft)", color: "var(--text)",
  fontFamily: "'Inter', system-ui, sans-serif",
  display: "flex", flexDirection: "column",
};

const btnGhost: React.CSSProperties = {
  padding: "7px 14px", fontSize: 12, background: "var(--card)",
  border: "1px solid var(--line)", borderRadius: 7, cursor: "pointer",
  color: "var(--text)", fontWeight: 500,
};

const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 5,
};

const inp: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, border: "1px solid var(--line)",
  borderRadius: 7, background: "var(--bg-soft)", color: "var(--text)",
  outline: "none", width: "100%", boxSizing: "border-box",
};
