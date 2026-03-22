"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../../lib/api";
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
type LotNote = { id: number; lot_id: number; title: string; content: string; created_at?: string };
type ValidityMode = "days" | "months" | "range";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", paused: "Pausado",
  revoked: "Revogado", finished: "Finalizado", trashed: "Lixeira",
};
const STATUS_COLOR: Record<string, string> = {
  active: "#16A34A", inactive: "#F59E0B", paused: "#F59E0B",
  revoked: "#DC2626", finished: "#6B7280", trashed: "#9CA3AF",
};

function fmtDt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ""; }
}

export default function LotDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const lotId = Number(params.id);
  const editRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  const [lot, setLot] = useState<Lot | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [notes, setNotes] = useState<LotNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "notes">("info");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eQty, setEQty] = useState("");
  const [vMode, setVMode] = useState<ValidityMode>("days");
  const [eDays, setEDays] = useState("");
  const [eMonths, setEMonths] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");

  // Note fields
  const [nTitle, setNTitle] = useState("");
  const [nContent, setNContent] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [listData, orgsData, notesData] = await Promise.allSettled([
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/organizations"),
        apiGet(`/api/v1/lot-notes/${lotId}`),
      ]);

      const lotList = listData.status === "fulfilled" ? (listData.value as Lot[]) : [];
      const found = lotList.find((l) => l.id === lotId) || null;
      setLot(found);
      if (found) populateEdit(found);

      if (orgsData.status === "fulfilled" && found) {
        const o = (orgsData.value as Org[]).find((x) => x.id === found.organization_id) || null;
        setOrg(o);
      }

      if (notesData.status === "fulfilled") setNotes((notesData.value as LotNote[]) || []);
    } finally {
      setLoading(false);
    }
  }

  function populateEdit(l: Lot) {
    setETitle(l.title || "");
    setEDesc(l.description || "");
    setEQty(String(l.total_badges));
    if (l.start_date && l.end_date) {
      setVMode("range");
      setEStart(toLocalInput(l.start_date));
      setEEnd(toLocalInput(l.end_date));
      setEDays(String(l.issue_window_days));
    } else {
      setVMode("days");
      setEDays(String(l.issue_window_days || ""));
      setEStart(""); setEEnd("");
    }
    setEMonths("");
  }

  function calcDays(mode: ValidityMode, d: string, m: string, s: string, e: string) {
    if (mode === "days") return parseInt(d) || 0;
    if (mode === "months") return (parseInt(m) || 0) * 30;
    if (mode === "range" && s && e) return Math.max(0, Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000));
    return 0;
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!lot) return;
    setSaving(true); setMsg("");
    const days = calcDays(vMode, eDays, eMonths, eStart, eEnd);
    try {
      await apiPatch(`/api/v1/lots/${lot.id}`, {
        title: eTitle.trim() || undefined,
        description: eDesc.trim() || undefined,
        total_badges: parseInt(eQty) || undefined,
        issue_window_days: days || undefined,
        start_date: vMode === "range" ? eStart || null : null,
        end_date: vMode === "range" ? eEnd || null : null,
      });
      logAction("Lote editado", `ID ${lot.id} · ${eTitle || `Lote ${lot.id}`}`);
      setMsg("Lote atualizado com sucesso.");
      setEditing(false);
      await loadAll();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function handleAddNote(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nContent.trim()) return;
    setSaving(true); setMsg("");
    try {
      await apiPost(`/api/v1/lot-notes/${lotId}`, { title: nTitle.trim() || undefined, content: nContent.trim() });
      setNTitle(""); setNContent("");
      setMsg("Anotação salva.");
      await loadAll();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar anotação.");
    } finally { setSaving(false); }
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm("Remover esta anotação?")) return;
    try {
      await apiDelete(`/api/v1/lot-notes/${noteId}`);
      await loadAll();
    } catch { setMsg("Erro ao remover anotação."); }
  }

  function openEdit() {
    if (lot) populateEdit(lot);
    setEditing(true);
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  if (loading) return (
    <main style={page}><span style={{ color: "var(--muted)" }}>Carregando...</span></main>
  );

  if (!lot) return (
    <main style={page}>
      <p style={{ color: "var(--muted)" }}>Lote não encontrado.</p>
      <button onClick={() => router.push("/admin/lots")} style={btnGhost}>← Lotes</button>
    </main>
  );

  const pct = lot.total_badges > 0 ? Math.round((lot.issued / lot.total_badges) * 100) : 0;
  const sColor = STATUS_COLOR[lot.status] || "#9CA3AF";
  const editDays = calcDays(vMode, eDays, eMonths, eStart, eEnd);

  return (
    <main style={page}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <button onClick={() => router.push("/admin/lots")} style={{ ...btnGhost, padding: "3px 9px", fontSize: 11 }}>← Lotes</button>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--primary)" }}>
              {lot.title || `Lote #${lot.id}`}
            </h1>
            <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}55` }}>
              {STATUS_LABEL[lot.status] || lot.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span>#{lot.id}</span>
            <span>·</span>
            {org
              ? <Link href={`/admin/organizations/${lot.organization_id}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>{org.name}</Link>
              : <Link href={`/admin/organizations/${lot.organization_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>Org #{lot.organization_id}</Link>
            }
            {lot.created_at && <><span>·</span><span>Criado {fmtDt(lot.created_at)}</span></>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link href={`/admin/organizations/${lot.organization_id}`} style={{ ...btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            🏢 Organização
          </Link>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: "9px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14,
          background: msg.includes("sucesso") || msg.includes("salva") ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
          border: `1px solid ${msg.includes("sucesso") || msg.includes("salva") ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
          color: msg.includes("sucesso") || msg.includes("salva") ? "var(--success)" : "var(--danger)",
        }}>{msg}</div>
      )}

      {/* ── KPI Cards — todos clicáveis → abrem edição ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total de Badges", value: lot.total_badges, hint: "Editar" },
          { label: "Emitidos", value: lot.issued, hint: null },
          { label: "Saldo", value: lot.remaining, hint: null },
          { label: "Validade (dias)", value: lot.issue_window_days || "—", hint: "Editar" },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.hint ? openEdit : undefined}
            title={item.hint ? "Clique para editar" : undefined}
            style={{
              background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
              padding: "12px 14px", textAlign: "left", cursor: item.hint ? "pointer" : "default",
              transition: "all 0.15s",
            }}
            className={item.hint ? "kpi-clickable" : ""}
          >
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>{item.value}</div>
            {item.hint && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Clique para editar →</div>}
          </button>
        ))}
      </div>

      {/* Org + datas info */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <InfoField label="Organização">
            {org
              ? <Link href={`/admin/organizations/${lot.organization_id}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>{org.name} →</Link>
              : <span>#{lot.organization_id}</span>
            }
          </InfoField>
          {lot.description && <InfoField label="Descrição"><span>{lot.description}</span></InfoField>}
          {lot.start_date && <InfoField label="Prazo início"><span>{fmtDt(lot.start_date)}</span></InfoField>}
          {lot.end_date && <InfoField label="Prazo fim"><span>{fmtDt(lot.end_date)}</span></InfoField>}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Utilização dos badges</span>
          <span style={{ fontWeight: 700, color: pct >= 90 ? "#DC2626" : "var(--text)" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#DC2626" : pct >= 70 ? "#F59E0B" : "var(--accent)", borderRadius: 99, transition: "width 0.4s" }} />
        </div>
        <div style={{ marginTop: 5, fontSize: 11, color: "var(--muted)" }}>{lot.issued} emitidos · {lot.remaining} disponíveis · {lot.total_badges} total</div>
      </div>

      {/* ── Tabs: Info / Anotações ── */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
          {([["info", "Informações"], ["notes", `Anotações${notes.length > 0 ? ` (${notes.length})` : ""}`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: tab === key ? 600 : 400,
                background: tab === key ? "rgba(91,45,142,0.08)" : "transparent",
                border: "none", borderBottom: tab === key ? "2px solid var(--primary)" : "2px solid transparent",
                color: tab === key ? "var(--primary)" : "var(--muted)", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === "info" && (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px 20px" }}>
              <InfoRow label="ID" value={`#${lot.id}`} />
              <InfoRow label="Título" value={lot.title || "—"} />
              <InfoRow label="Status" value={STATUS_LABEL[lot.status] || lot.status} />
              <InfoRow label="Total de Badges" value={String(lot.total_badges)} />
              <InfoRow label="Emitidos" value={String(lot.issued)} />
              <InfoRow label="Saldo" value={String(lot.remaining)} />
              <InfoRow label="Validade" value={`${lot.issue_window_days} dias`} />
              {lot.start_date && <InfoRow label="Prazo início" value={fmtDt(lot.start_date)} />}
              {lot.end_date && <InfoRow label="Prazo fim" value={fmtDt(lot.end_date)} />}
              {lot.description && <InfoRow label="Descrição" value={lot.description} />}
              {lot.created_at && <InfoRow label="Criado em" value={fmtDt(lot.created_at)} />}
            </div>
            <button onClick={openEdit} style={{ ...btnGhost, marginTop: 14, fontSize: 12 }}>
              ✏️ Editar Lote
            </button>
          </div>
        )}

        {/* Notes tab */}
        {tab === "notes" && (
          <div style={{ padding: "16px" }}>
            {/* Add note form */}
            <form onSubmit={handleAddNote} style={{ display: "grid", gap: 8, marginBottom: 16, padding: "14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Nova Anotação</div>
              <input
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
                placeholder="Título (opcional)"
                style={inp}
              />
              <textarea
                value={nContent}
                onChange={(e) => setNContent(e.target.value)}
                placeholder="Conteúdo da anotação..."
                required
                rows={3}
                style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
              />
              <div>
                <button type="submit" disabled={saving || !nContent.trim()} style={{
                  padding: "7px 16px", fontSize: 12, fontWeight: 600,
                  background: "var(--primary)", color: "#fff", border: "none",
                  borderRadius: 6, cursor: saving ? "not-allowed" : "pointer",
                  opacity: !nContent.trim() ? 0.5 : 1,
                }}>
                  Salvar anotação
                </button>
              </div>
            </form>

            {/* Notes list */}
            {notes.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>
                Nenhuma anotação ainda.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ padding: "12px 14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                      <strong style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{n.title}</strong>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.created_at?.slice(0, 10) || ""}</span>
                        <button onClick={() => handleDeleteNote(n.id)} style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--danger)", fontSize: 11, padding: "2px 6px",
                          borderRadius: 4, fontWeight: 500,
                        }}>Excluir</button>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit form ── */}
      {editing && (
        <div ref={editRef} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid var(--line)", color: "var(--text)" }}>
            Editar Lote #{lot.id}
          </h2>
          <form onSubmit={handleSave} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Título</label>
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Ex.: Turma Janeiro 2025" style={inp} />
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Opcional" style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Quantidade total de badges</label>
              <input type="number" min={lot.issued || 1} value={eQty} onChange={(e) => setEQty(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
              {lot.issued > 0 && <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 3 }}>Mínimo: {lot.issued} (já emitidos)</span>}
            </div>

            <div>
              <label style={lbl}>Validade</label>
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {(["days", "months", "range"] as ValidityMode[]).map((m) => {
                  const labels = { days: "Dias", months: "Meses", range: "Período (início/fim)" };
                  return (
                    <button key={m} type="button" onClick={() => setVMode(m)} style={{
                      padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "1px solid",
                      cursor: "pointer", fontWeight: vMode === m ? 600 : 400,
                      background: vMode === m ? "rgba(181,212,0,0.15)" : "var(--bg-soft)",
                      color: vMode === m ? "var(--primary)" : "var(--muted)",
                      borderColor: vMode === m ? "rgba(181,212,0,0.4)" : "var(--line)",
                    }}>{labels[m]}</button>
                  );
                })}
              </div>

              {vMode === "days" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min={1} value={eDays} onChange={(e) => setEDays(e.target.value)} style={{ ...inp, maxWidth: 120 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>dias</span>
                </div>
              )}
              {vMode === "months" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min={1} value={eMonths} onChange={(e) => setEMonths(e.target.value)} placeholder="12" style={{ ...inp, maxWidth: 120 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>meses{eMonths ? ` (≈ ${parseInt(eMonths) * 30} dias)` : ""}</span>
                </div>
              )}
              {vMode === "range" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ ...lbl, marginBottom: 4 }}>Prazo de início</label>
                    <input type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={{ ...lbl, marginBottom: 4 }}>Prazo de fim</label>
                    <input type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} style={inp} />
                  </div>
                  {eStart && eEnd && (
                    <span style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)" }}>
                      Equivale a <strong>{editDays}</strong> dias de validade
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
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
              <button type="button" onClick={() => { setEditing(false); setMsg(""); }} style={btnGhost}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <style>{`.kpi-clickable:hover { border-color: rgba(91,45,142,0.4) !important; box-shadow: 0 2px 10px rgba(91,45,142,0.1); transform: translateY(-1px); }`}</style>
    </main>
  );
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}: </span>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: "24px 28px", minHeight: "100vh",
  background: "var(--bg-soft)", color: "var(--text)",
  fontFamily: "'Inter', system-ui, sans-serif",
};

const btnGhost: React.CSSProperties = {
  padding: "7px 13px", fontSize: 12, background: "var(--card)",
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
