"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../../../../../lib/api";
import { getRole } from "../../../../../lib/auth";

type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
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

export default function LotDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lot, setLot] = useState<Lot | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [message, setMessage] = useState("");

  async function loadData() {
    const [lotsData, orgsData] = await Promise.all([apiGet('/api/v1/lots'), apiGet('/api/v1/organizations')]);
    setLot((lotsData as Lot[]).find((l) => l.id === Number(params.id)) || null);
    setOrgs(orgsData as Org[]);
  }

  useEffect(() => {
    if (getRole() !== "admin") return router.push('/login');
    loadData().catch(() => router.push('/admin/lots'));
  }, [params.id, router]);

  const org = useMemo(() => orgs.find((o) => o.id === lot?.organization_id), [orgs, lot]);

  async function updateStatus(status: string) {
    if (!lot) return;
    try {
      await apiPatch(`/api/v1/lots/${lot.id}`, { status });
      await loadData();
      setMessage(`Lote atualizado para ${statusLabel(status)}.`);
    } catch {
      setMessage("Erro ao atualizar lote.");
    }
  }

  async function editTotal() {
    if (!lot) return;
    const v = window.prompt("Novo total de badges:", String(lot.total_badges));
    if (!v) return;
    const n = Number(v);
    if (Number.isNaN(n)) return;
    try {
      await apiPatch(`/api/v1/lots/${lot.id}`, { total_badges: n });
      await loadData();
      setMessage("Quantidade atualizada.");
    } catch {
      setMessage("Erro ao atualizar quantidade.");
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Detalhes do lote</h1>
        <button className="btn-ghost" onClick={() => router.push('/admin/lots')}>← Voltar</button>
      </div>

      {message && <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>}
      {!lot && <p className="error">Lote não encontrado.</p>}

      {lot && (
        <section className="card">
          <h2>{lot.title || `Lote #${lot.id}`}</h2>
          <p><strong>Empresa:</strong> {org?.name || lot.organization_id}</p>
          <p><strong>Status:</strong> {statusLabel(lot.status)}</p>
          <p><strong>Total:</strong> {lot.total_badges}</p>
          <p><strong>Emitidos:</strong> {lot.issued}</p>
          <p><strong>Saldo:</strong> {lot.remaining}</p>
          <p><strong>Janela de emissão:</strong> {lot.issue_window_days} dias</p>
          <p><strong>Descrição:</strong> {lot.description || "-"}</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn-ghost" onClick={editTotal}>Editar quantidade</button>
            <button className="btn-ghost" onClick={() => updateStatus("active")}>Ativar</button>
            <button className="btn-ghost" onClick={() => updateStatus("paused")}>Pausar</button>
            <button className="btn-ghost" onClick={() => updateStatus("revoked")}>Revogar</button>
            <button className="btn-ghost" onClick={() => updateStatus("trashed")}>Lixeira</button>
          </div>
        </section>
      )}
    </main>
  );
}
