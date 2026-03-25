"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { useToast } from "../../../../lib/toast-context";
import { useConfirm } from "../../../../lib/confirm-modal";

type Lot = {
  id: number;
  title: string | null;
  original_title: string | null;
  display_title: string | null;
  total_badges: number;
  issued: number;
  remaining: number;
  status: string;
  created_at: string | null;
  tem_documento?: boolean;
  imagem_url?: string | null;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active:  { bg: "rgba(34,197,94,0.12)",  text: "#16a34a", border: "rgba(34,197,94,0.3)" },
  paused:  { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.3)" },
  revoked: { bg: "rgba(239,68,68,0.12)",  text: "#dc2626", border: "rgba(239,68,68,0.3)" },
  finished:{ bg: "rgba(107,114,128,0.12)",text: "#4b5563", border: "rgba(107,114,128,0.3)" },
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", paused: "Pausado", revoked: "Revogado", finished: "Finalizado",
};

export default function IssuerLotsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await apiGet("/api/v1/lots");
    setLots(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function displayName(lot: Lot): string {
    return lot.display_title || lot.title || lot.original_title || `Lote #${lot.id}`;
  }

  function rootName(lot: Lot): string | null {
    if (!lot.display_title) return null;
    const root = lot.original_title || lot.title;
    if (!root || root === lot.display_title) return null;
    return root;
  }

  async function saveName(lot: Lot) {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/lots/${lot.id}/rename`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_title: editValue.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Nome atualizado");
      setEditingId(null);
      await load();
    } catch {
      toast.error("Erro ao renomear");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(lot: Lot, status: string) {
    if (status === "revoked") {
      const ok = await confirm(`Revogar o lote "${displayName(lot)}"? Esta ação é irreversível.`, { danger: true, confirmText: "Revogar" });
      if (!ok) return;
    }
    try {
      const res = await fetch(`/api/v1/lots/${lot.id}/set-status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Lote ${STATUS_LABELS[status] || status}`);
      await load();
    } catch {
      toast.error("Erro ao alterar status");
    }
  }

  function saldoPercent(lot: Lot) {
    if (!lot.total_badges) return 0;
    return Math.round((lot.remaining / lot.total_badges) * 100);
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", margin: 0 }}>
          📦 Meus Lotes
        </h1>
        <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, margin: "4px 0 0" }}>
          {user?.organization_name} · {lots.length} lote{lots.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary, #888)", fontSize: 13 }}>Carregando...</p>
      ) : lots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-secondary, #888)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 14 }}>Nenhum lote disponível ainda.</p>
          <p style={{ fontSize: 12 }}>Aguarde o administrador criar um lote para sua organização.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {lots.map((lot) => {
            const sc = STATUS_COLORS[lot.status] || STATUS_COLORS.finished;
            const root = rootName(lot);
            const pct = saldoPercent(lot);
            const isEditing = editingId === lot.id;

            return (
              <div
                key={lot.id}
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 10,
                  overflow: "hidden",
                  transition: "box-shadow 0.15s",
                }}
              >
                {lot.imagem_url && (
                  <div style={{ height: 80, overflow: "hidden", background: "#f3f4f6" }}>
                    <img src={lot.imagem_url} alt="Fundo do lote" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                  </div>
                )}
                <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  {/* Left: nome + root */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: lot.tem_documento ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)", color: lot.tem_documento ? "#16a34a" : "#6b7280", border: `1px solid ${lot.tem_documento ? "rgba(34,197,94,0.3)" : "rgba(107,114,128,0.3)"}` }}>
                        {lot.tem_documento ? "Com modelo" : "Sem modelo"}
                      </span>
                    </div>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveName(lot); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                          style={{ flex: 1, padding: "6px 10px", border: "1px solid #3b82f6", borderRadius: 6, fontSize: 14, fontWeight: 600 }}
                        />
                        <button onClick={() => saveName(lot)} disabled={saving}
                          style={{ background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {saving ? "..." : "Salvar"}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", color: "#666" }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary, #111)" }}>
                          {displayName(lot)}
                        </span>
                        {root && (
                          <span style={{ fontSize: 11, color: "var(--text-secondary, #888)", fontStyle: "italic" }}>
                            ({root})
                          </span>
                        )}
                        {lot.status !== "revoked" && (
                          <button
                            onClick={() => { setEditingId(lot.id); setEditValue(displayName(lot)); }}
                            title="Renomear lote"
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9ca3af", padding: "2px 4px", lineHeight: 1 }}
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}

                    {/* Saldo bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary, #666)", marginBottom: 4 }}>
                        <span>{lot.remaining} disponíveis de {lot.total_badges}</span>
                        <span>{pct}% restante</span>
                      </div>
                      <div style={{ height: 5, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: pct > 30 ? "#22c55e" : pct > 10 ? "#f59e0b" : "#ef4444",
                          borderRadius: 99,
                          transition: "width 0.3s",
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary, #888)", marginTop: 3 }}>
                        {lot.issued} emitidos
                      </div>
                    </div>
                  </div>

                  {/* Right: status + ações */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                      background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                    }}>
                      {STATUS_LABELS[lot.status] || lot.status}
                    </span>

                    <button
                      onClick={() => router.push(`/issuer/lots/${lot.id}`)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid #9ca3af", color: "#6b7280" }}
                    >
                      Documento
                    </button>
                    {lot.status !== "revoked" && lot.status !== "finished" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {lot.status === "active" && (
                          <button onClick={() => setStatus(lot, "paused")}
                            style={actionBtnStyle("#f59e0b")}>Pausar</button>
                        )}
                        {lot.status === "paused" && (
                          <button onClick={() => setStatus(lot, "active")}
                            style={actionBtnStyle("#22c55e")}>Ativar</button>
                        )}
                        <button onClick={() => setStatus(lot, "revoked")}
                          style={actionBtnStyle("#ef4444")}>Revogar</button>
                      </div>
                    )}
                  </div>
                </div>
                </div>{/* padding wrapper */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
    background: "transparent", border: `1px solid ${color}`, color: color,
  };
}
