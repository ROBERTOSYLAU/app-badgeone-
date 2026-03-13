"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../../lib/api";
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
  const [auditPeriod, setAuditPeriod] = useState("all");
  const [message, setMessage] = useState("");

  async function loadData() {
    const id = Number(params.id);
    const [lotsData, orgsData, auditData] = await Promise.all([
      apiGet('/api/v1/lots'),
      apiGet('/api/v1/organizations'),
      apiGet(`/api/v1/audit-logs?entity_type=lot&entity_id=${id}&period=${auditPeriod}&limit=200`),
    ]);
    setLot((lotsData as Lot[]).find((l) => l.id === id) || null);
    setOrgs(orgsData as Org[]);
    setAudit(auditData as Audit[]);
  }

  useEffect(() => {
    if (getRole() !== "admin") return router.push('/login');
    loadData().catch(() => router.push('/admin/lots'));
  }, [params.id, router, auditPeriod]);

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

  async function revokeLot() {
    if (!lot) return;
    const mode = window.prompt("Tipo de revogação: FULL (total) ou PARTIAL (parcial)", "PARTIAL");
    if (!mode) return;
    const up = mode.toUpperCase();

    if (up === "FULL") {
      const ack = window.prompt("Digite REVOGAR para confirmar revogação TOTAL");
      if (ack !== "REVOGAR") return;
      await apiPost(`/api/v1/lots/${lot.id}/revoke`, { mode: "full" });
      await loadData();
      setMessage("Lote revogado totalmente.");
      return;
    }

    const qtyInput = window.prompt("Quantidade a revogar (somente saldo não emitido)", "1");
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty <= 0) return;
    const ack = window.prompt(`Digite REVOGAR para confirmar revogação parcial de ${qty}`);
    if (ack !== "REVOGAR") return;

    try {
      await apiPost(`/api/v1/lots/${lot.id}/revoke`, { mode: "partial", quantity: qty });
      await loadData();
      setMessage("Revogação parcial concluída.");
    } catch {
      setMessage("Erro ao revogar lote.");
    }
  }

  async function clearAudit() {
    const ack = window.prompt("Limpar histórico deste lote. Digite LIMPAR");
    if (ack !== "LIMPAR") return;
    try {
      await apiDelete(`/api/v1/audit-logs?entity_type=lot&entity_id=${Number(params.id)}&period=${auditPeriod}`);
      await loadData();
      setMessage("Histórico limpo.");
    } catch {
      setMessage("Erro ao limpar histórico.");
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
            <button className="btn-ghost" onClick={revokeLot}>Revogar</button>
            <button className="btn-ghost" onClick={() => updateStatus("trashed")}>Lixeira</button>
          </div>

          <div className="card" style={{ marginTop: 14, marginBottom: 0 }}>
            <h2 style={{ fontSize: 16 }}>Histórico de ações do lote</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <select value={auditPeriod} onChange={(e) => setAuditPeriod(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="all">Tudo</option>
                <option value="day">Último dia</option>
                <option value="week">Última semana</option>
                <option value="month">Último mês</option>
              </select>
              <button className="btn-ghost" onClick={clearAudit}>Limpar histórico</button>
            </div>
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
