"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { logAction } from "../../../../lib/history";
import { useToast } from "../../../../lib/toast-context";

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

export default function AdminLotsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const toast = useToast();

  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create lot form
  const [selOrgId, setSelOrgId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("");
  const [validityMode, setValidityMode] = useState<ValidityMode>("days");
  const [newDays, setNewDays] = useState("365");
  const [newMonths, setNewMonths] = useState("");
  const [newRangeStart, setNewRangeStart] = useState("");
  const [newRangeEnd, setNewRangeEnd] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") { router.push("/login"); return; }
    loadAll();
  }, [user, isLoading]);

  async function loadAll() {
    setLoading(true);
    try {
      const [lotsData, orgsData] = await Promise.all([
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/organizations"),
      ]);
      setLots((lotsData as Lot[]) || []);
      setOrgs((orgsData as Org[]) || []);
    } catch {
      setLots([]);
    } finally {
      setLoading(false);
    }
  }

  function computeDays() {
    if (validityMode === "days") return parseInt(newDays) || 0;
    if (validityMode === "months") return (parseInt(newMonths) || 0) * 30;
    if (validityMode === "range" && newRangeStart && newRangeEnd) {
      const diff = Math.ceil((new Date(newRangeEnd).getTime() - new Date(newRangeStart).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    }
    return 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selOrgId) { toast.error("Selecione uma organização."); return; }
    const days = computeDays();
    if (!parseInt(newQty) || parseInt(newQty) <= 0) { toast.error("Quantidade deve ser maior que 0."); return; }
    if (!days || days <= 0) { toast.error("Informe uma validade maior que zero."); return; }
    setSaving(true);
    try {
      await apiPost("/api/v1/lots", {
        organization_id: parseInt(selOrgId),
        title: newTitle.trim() || undefined,
        description: newDesc.trim() || undefined,
        total_badges: parseInt(newQty),
        issue_window_days: days,
        start_date: validityMode === "range" ? newRangeStart || undefined : undefined,
        end_date: validityMode === "range" ? newRangeEnd || undefined : undefined,
      });
      logAction("Lote criado", `Org #${selOrgId} · ${newTitle || "Sem título"}`);
      toast.success("Lote criado com sucesso!");
      setShowForm(false);
      setSelOrgId(""); setNewTitle(""); setNewDesc(""); setNewQty("");
      setNewDays("365"); setNewMonths(""); setNewRangeStart(""); setNewRangeEnd("");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar lote.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    let base = filterStatus === "all" ? lots : lots.filter((l) => l.status === filterStatus);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) =>
      [l.title, String(l.id), String(l.organization_id), l.status]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [lots, filterStatus, search]);

  const orgMap = useMemo(() => {
    const m: Record<number, string> = {};
    orgs.forEach((o) => { m[o.id] = o.name; });
    return m;
  }, [orgs]);

  const tabs = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "finished", label: "Finalizados" },
  ];

  return (
    <main style={{ padding: "28px 28px", minHeight: "100vh", background: "var(--bg-soft)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--primary)" }}>Lotes</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            {lots.length} lotes · {lots.filter((l) => l.status === "active").length} ativos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowForm((v) => !v); }} style={{ ...btn, ...(showForm ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}) }}>
            {showForm ? "Cancelar" : "+ Criar Lote"}
          </button>
          <button onClick={loadAll} style={btn}>Atualizar</button>
        </div>
      </div>

      {/* Create lot form */}
      {showForm && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "18px 22px", marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid var(--line)", color: "var(--text)" }}>
            Criar Novo Lote
          </h2>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 14 }}>
            {/* Org selector */}
            <div>
              <label style={lbl}>Organização *</label>
              <select value={selOrgId} onChange={(e) => setSelOrgId(e.target.value)} required style={{ ...inp, maxWidth: 360 }}>
                <option value="">Selecione uma organização...</option>
                {orgs.filter((o) => o.status !== "trashed").map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Title + Description */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Título do lote</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Turma Janeiro 2025" style={inp} />
              </div>
              <div>
                <label style={lbl}>Descrição (opcional)</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Opcional" style={inp} />
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label style={lbl}>Quantidade total de badges *</label>
              <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="100" style={{ ...inp, maxWidth: 160 }} />
            </div>

            {/* Validity */}
            <div>
              <label style={lbl}>Validade *</label>
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
                  <input type="number" min={1} value={newDays} onChange={(e) => setNewDays(e.target.value)} style={{ ...inp, maxWidth: 120 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>dias</span>
                </div>
              )}

              {validityMode === "months" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min={1} value={newMonths} onChange={(e) => setNewMonths(e.target.value)} placeholder="12" style={{ ...inp, maxWidth: 120 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    meses{newMonths ? ` (≈ ${parseInt(newMonths) * 30} dias)` : ""}
                  </span>
                </div>
              )}

              {validityMode === "range" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ ...lbl, marginBottom: 4 }}>Prazo de início</label>
                    <input type="datetime-local" value={newRangeStart} onChange={(e) => setNewRangeStart(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={{ ...lbl, marginBottom: 4 }}>Prazo de fim</label>
                    <input type="datetime-local" value={newRangeEnd} onChange={(e) => setNewRangeEnd(e.target.value)} style={inp} />
                  </div>
                  {newRangeStart && newRangeEnd && (
                    <span style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)" }}>
                      Equivale a <strong>{computeDays()}</strong> dias de validade
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} style={{
                padding: "9px 20px", fontSize: 13, fontWeight: 600,
                background: "var(--primary)", color: "#fff", border: "none",
                borderRadius: 7, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Criando..." : "Criar Lote"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); }} style={btn}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Lot list */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {/* Filter bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setFilterStatus(t.key)} style={{
                padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "1px solid transparent",
                cursor: "pointer", fontWeight: filterStatus === t.key ? 600 : 400,
                background: filterStatus === t.key ? "rgba(181,212,0,0.18)" : "transparent",
                color: filterStatus === t.key ? "var(--primary)" : "var(--muted)",
                borderColor: filterStatus === t.key ? "rgba(181,212,0,0.35)" : "transparent",
              }}>
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lote..."
            style={{ marginLeft: "auto", padding: "5px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-soft)", color: "var(--text)", outline: "none", width: 200 }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Nenhum lote encontrado.</div>
        ) : (
          <div>
            {filtered.map((l, idx) => {
              const pct = l.total_badges > 0 ? Math.round((l.issued / l.total_badges) * 100) : 0;
              const color = statusColor(l.status);
              const orgName = orgMap[l.organization_id];
              return (
                <Link
                  key={l.id}
                  href={`/admin/lots/${l.id}`}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--line)" : "none",
                    textDecoration: "none", color: "var(--text)", transition: "background 0.15s",
                  }}
                  className="lot-row"
                >
                  <div style={{ display: "grid", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>{l.title || `Lote ${l.id}`}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>#{l.id}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                      {orgName && <span>{orgName}</span>}
                      <span>{l.issued}/{l.total_badges} emitidos</span>
                      {l.issue_window_days > 0 && <span>Validade: {l.issue_window_days}d</span>}
                    </div>
                    <div style={{ height: 4, background: "var(--line)", borderRadius: 99, overflow: "hidden", maxWidth: 240 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#DC2626" : pct >= 70 ? "#F59E0B" : "var(--accent)", borderRadius: 99 }} />
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}60`, whiteSpace: "nowrap" }}>
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

const btn: React.CSSProperties = {
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
