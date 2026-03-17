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
  detail?: string;
  created_at?: string;
};

type FilterKey = "1h" | "today" | "7d" | "30d" | "all";

function formatDateBR(value?: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleString("pt-BR");
  return value;
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
      const data = await apiGet("/api/v1/audit");
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
      await apiDelete("/api/v1/audit");
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
        <p className={message.toLowerCase().includes("erro") ? "error" : "success"}>
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
            {filtered.map((item) => (
              <section
                key={item.id}
                className="card"
                style={{ marginBottom: 0, background: "rgba(255,255,255,0.02)" }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>
                      {item.entity_type} #{item.entity_id}
                    </strong>
                    <span className="muted">{formatDateBR(item.created_at)}</span>
                  </div>

                  <div>
                    <strong>Ação:</strong> {item.action}
                  </div>

                  <div className="muted">{item.detail || "Sem detalhes."}</div>
                </div>
              </section>
            ))}

            {!filtered.length && <section className="card" style={{ marginBottom: 0 }}>Nenhum registro encontrado.</section>}
          </div>
        )}
      </section>
    </main>
  );
}
