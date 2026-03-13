"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../../../../../lib/api";
import { getRole } from "../../../../../lib/auth";

type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
type Org = { id: number; name: string };
type Audit = { id: number; action: string; details?: string; actor?: string; created_at?: string };

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
  const [audit, setAudit] = useState<Audit[]>([]);
  const [message, setMessage] = useState("");

  async function loadData() {
    const id = Number(params.id);
    const [lotsData, orgsData, auditData] = await Promise.all([
      apiGet('/api/v1/lots'),
      apiGet('/api/v1/organizations'),
      apiGet(`/api/v1/audit-logs?entity_type=lot&entity_id=${id}&limit=50`),
    ]);
    setLot((lotsData as Lot[]).find((l) => l.id === id) || null);
    setOrgs(orgsData as Org[]);
    setAudit(auditData as Audit[]);
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

          <div className="card" style={{ marginTop: 14, marginBottom: 0 }}>
            <h2 style={{ fontSize: 16 }}>Histórico de ações do lote</h2>
            <ul className="list">
              {audit.map((a) => (
                <li key={a.id}>
                  <strong>{a.action}</strong> <span className="muted">({a.created_at?.replace('T', ' ').slice(0, 19) || '-'})</span>
                  {a.details ? <p>{a.details}</p> : null}
                </li>
              ))}
              {!audit.length && <li>Sem histórico ainda.</li>}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
