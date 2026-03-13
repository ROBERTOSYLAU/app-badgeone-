"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { getRole } from "../../../../lib/auth";

type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; status: string };
type Org = { id: number; name: string };

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    paused: "Pausado",
    revoked: "Revogado",
    finished: "Finalizado",
    trashed: "Lixeira",
  };
  return map[status] || status;
}

function titleByFilter(status: string) {
  const map: Record<string, string> = {
    all: "Todos",
    active: "Ativos",
    paused: "Pausados",
    revoked: "Revogados",
    finished: "Finalizados",
    trashed: "Lixeira",
  };
  return map[status] || status;
}

export default function AdminLotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [recoverQtyByLot, setRecoverQtyByLot] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");

  async function loadData() {
    const [l, o] = await Promise.all([apiGet('/api/v1/lots'), apiGet('/api/v1/organizations')]);
    setLots(l);
    setOrgs(o);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("status") || "all";
      setStatus(s);
    }
    if (getRole() !== "admin") return router.push('/login');
    loadData().catch(() => router.push('/admin'));
  }, [router]);

  const filtered = useMemo(() => status === "all" ? lots : lots.filter((l) => l.status === status), [lots, status]);

  async function restoreLot(lot: Lot) {
    const ok = window.confirm(`Confirmar recuperação do lote ${lot.title || '#' + lot.id}?`);
    if (!ok) return;

    const qty = recoverQtyByLot[lot.id] ?? 0;

    try {
      await apiPost(`/api/v1/lots/${lot.id}/recover`, { quantity: qty, to_status: "active" });
      setMessage("Lote recuperado com sucesso.");
      await loadData();
    } catch {
      setMessage("Erro ao recuperar lote.");
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Lotes ({titleByFilter(status)})</h1>
        <button className="btn-ghost" onClick={() => router.push('/admin')}>← Voltar</button>
      </div>

      {message && <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>}

      <section className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button className={status === "all" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("all")}>Todos</button>
          <button className={status === "active" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("active")}>Ativos</button>
          <button className={status === "paused" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("paused")}>Pausados</button>
          <button className={status === "revoked" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("revoked")}>Revogados</button>
          <button className={status === "trashed" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("trashed")}>Lixeira</button>
        </div>
        <ul className="list">
          {filtered.map((l, i) => {
            const org = orgs.find((o) => o.id === l.organization_id);
            return (
              <li key={l.id}>
                {i + 1}. <Link href={`/admin/lots/${l.id}`}>{l.title || `Lote #${l.id}`}</Link> | Empresa {org?.name || l.organization_id} | Status {statusLabel(l.status)} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}
                {(l.status === "revoked" || l.status === "trashed") && (
                  <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="number"
                      min={0}
                      value={recoverQtyByLot[l.id] ?? 0}
                      onChange={(e) => setRecoverQtyByLot((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))}
                      style={{ maxWidth: 140 }}
                    />
                    <button className="btn-ghost" onClick={() => restoreLot(l)}>Recuperar lote</button>
                  </div>
                )}
              </li>
            );
          })}
          {!filtered.length && <li>Nenhum lote.</li>}
        </ul>
      </section>
    </main>
  );
}
