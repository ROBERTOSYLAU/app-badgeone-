"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../../lib/api";
import { useToast } from "../../../../lib/toast-context";

type Cred = {
  id: number;
  public_id: string;
  recipient_name: string;
  recipient_email?: string;
  course_name: string;
  status: string;
  tx_hash?: string;
  created_at?: string;
  issued_by_user_id?: number;
};

type RectifyState = {
  cred: Cred;
  name: string;
  email: string;
  course: string;
  note: string;
  loading: boolean;
  error: string;
};

const STATUS_LABELS: Record<string, string> = {
  valid: "Válida", paused: "Pausada", revoked: "Revogada",
  rectified: "Retificada", trashed: "Lixeira",
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  valid:     { bg: "#dcfce7", color: "#166534" },
  rectified: { bg: "#fef9c3", color: "#854d0e" },
  paused:    { bg: "#fff7ed", color: "#9a3412" },
  revoked:   { bg: "#fee2e2", color: "#991b1b" },
  trashed:   { bg: "#f3f4f6", color: "#6b7280" },
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CredentialsPage() {
  const toast = useToast();
  const [creds, setCreds] = useState<Cred[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rectify, setRectify] = useState<RectifyState | null>(null);

  async function load() {
    const data = await apiGet("/api/v1/credentials");
    setCreds(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = creds.filter(
    (c) =>
      c.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_name.toLowerCase().includes(search.toLowerCase()) ||
      c.public_id.toLowerCase().includes(search.toLowerCase())
  );

  function openRectify(c: Cred) {
    setRectify({ cred: c, name: c.recipient_name, email: c.recipient_email || "", course: c.course_name, note: "", loading: false, error: "" });
  }

  async function submitRectify() {
    if (!rectify) return;
    if (!rectify.note.trim()) {
      setRectify({ ...rectify, error: "Nota de retificação é obrigatória." });
      return;
    }
    setRectify({ ...rectify, loading: true, error: "" });
    try {
      const res = await fetch(`/api/v1/credentials/${rectify.cred.id}/rectify`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: rectify.name.trim() || undefined,
          recipient_email: rectify.email.trim() || undefined,
          course_name: rectify.course.trim() || undefined,
          rectification_note: rectify.note.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erro");
      }
      setRectify(null);
      toast.success("Retificação registrada com sucesso.");
      await load();
    } catch (e: any) {
      setRectify({ ...rectify, loading: false, error: e.message || "Erro ao retificar." });
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 6 }}>
        📋 Credenciais emitidas
      </h1>
      <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, marginBottom: 20 }}>
        Histórico de certificações emitidas pela sua organização.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, certificação ou ID..."
          style={{ padding: "8px 12px", border: "1px solid var(--border, #d1d5db)", borderRadius: 7, fontSize: 13, width: 300, background: "var(--card-bg, #fff)", color: "var(--text-primary, #111)" }}
        />
        <Link href="/issuer/emit"
          style={{ background: "#1A3A5C", color: "#fff", borderRadius: 7, padding: "8px 16px", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          + Emitir certificação
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary, #888)", fontSize: 13 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary, #888)", fontSize: 13 }}>
          {search ? "Nenhum resultado encontrado." : "Nenhuma credencial emitida ainda."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((c) => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.trashed;
            const isRectifying = rectify?.cred.id === c.id;

            return (
              <div key={c.id} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
                {/* Main row */}
                <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary, #111)" }}>
                      {c.recipient_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 2 }}>
                      {c.course_name}
                      {c.recipient_email && <> · {c.recipient_email}</>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary, #aaa)", marginTop: 3, display: "flex", gap: 12 }}>
                      <span style={{ fontFamily: "monospace" }}>{c.public_id}</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                    {(c.status === "valid" || c.status === "rectified") && (
                      <button
                        onClick={() => isRectifying ? setRectify(null) : openRectify(c)}
                        style={{ fontSize: 12, color: "#1A3A5C", background: "none", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 500 }}
                      >
                        {isRectifying ? "Cancelar" : "Retificar emissão"}
                      </button>
                    )}
                    <Link href={`/verify/${c.public_id}`} target="_blank"
                      style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", fontWeight: 500 }}>
                      Verificar →
                    </Link>
                  </div>
                </div>

                {/* Retificar panel */}
                {isRectifying && rectify && (
                  <div style={{ borderTop: "1px solid #e5e7eb", padding: "16px 18px", background: "#f8fafc" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1A3A5C", marginBottom: 12 }}>
                      ✏️ Retificar dados da emissão
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={lbl}>Nome do destinatário</label>
                        <input value={rectify.name} onChange={(e) => setRectify({ ...rectify, name: e.target.value })} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>E-mail</label>
                        <input value={rectify.email} onChange={(e) => setRectify({ ...rectify, email: e.target.value })} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Certificação</label>
                        <input value={rectify.course} onChange={(e) => setRectify({ ...rectify, course: e.target.value })} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={{ ...lbl, color: "#dc2626" }}>Nota de retificação * (obrigatória — fica registrada)</label>
                        <textarea
                          value={rectify.note}
                          onChange={(e) => setRectify({ ...rectify, note: e.target.value })}
                          placeholder="Descreva o motivo da retificação..."
                          rows={2}
                          style={{ ...inp, resize: "vertical" }}
                        />
                      </div>
                    </div>
                    {rectify.error && (
                      <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{rectify.error}</p>
                    )}
                    <button
                      onClick={submitRectify}
                      disabled={rectify.loading}
                      style={{ background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {rectify.loading ? "Registrando..." : "Confirmar retificação"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-secondary, #aaa)" }}>
        {filtered.length} credencial{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
