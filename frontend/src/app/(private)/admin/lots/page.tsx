"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; status: string };
type Org = { id: number; name: string; status?: string };

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
  const { user, isLoading } = useAuth();
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [recoverQtyByLot, setRecoverQtyByLot] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  
  // Create lot form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [lotTitle, setLotTitle] = useState("");
  const [lotDescription, setLotDescription] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");

  async function loadData() {
    const [l, o] = await Promise.all([apiGet('/api/v1/lots'), apiGet('/api/v1/organizations')]);
    setLots(l);
    setOrgs(o);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.push('/login');
      return;
    }
    loadData().catch(() => {});
  }, [user, isLoading, router]);

  async function createLot(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(lotQuantity);
    if (!qty || qty <= 0) {
      setMessage("Quantidade deve ser maior que 0");
      return;
    }
    if (!selectedOrg) {
      setMessage("Selecione uma organização");
      return;
    }
    try {
      await apiPost("/api/v1/lots", {
        organization_id: Number(selectedOrg),
        title: lotTitle || `Lote ${new Date().toLocaleDateString('pt-BR')}`,
        description: lotDescription,
        total_badges: qty,
      });
      setMessage("Lote criado com sucesso!");
      setShowCreateForm(false);
      setLotTitle("");
      setLotDescription("");
      setLotQuantity("");
      setSelectedOrg("");
      loadData();
    } catch {
      setMessage("Erro ao criar lote.");
    }
  }

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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Cancelar" : "+ Criar Lote"}
          </button>
          <button className="btn-ghost" onClick={() => router.back()}>← Voltar</button>
        </div>
      </div>

      {message && <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>}

      {showCreateForm && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>Novo Lote</h2>
          <form onSubmit={createLot}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label>Organização *</label>
                <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} required style={{ width: "100%", padding: 10, borderRadius: 8, background: "#0a163e", color: "#fff", border: "1px solid #2a3b73" }}>
                  <option value="">Selecione uma organização</option>
                  {orgs.filter(o => o.status === 'active').map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {orgs.filter(o => o.status === 'active').length === 0 && (
                  <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>Nenhuma organização ativa disponível. Ative ou cadastre uma organização primeiro.</p>
                )}
              </div>
              <div>
                <label>Título do Lote (opcional)</label>
                <input value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Ex: Lote Março 2024" />
              </div>
              <div>
                <label>Descrição (opcional)</label>
                <input value={lotDescription} onChange={(e) => setLotDescription(e.target.value)} placeholder="Descrição do lote" />
              </div>
              <div>
                <label>Quantidade de Badges *</label>
                <input type="number" value={lotQuantity} onChange={(e) => setLotQuantity(e.target.value)} placeholder="100" required min="1" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit">Criar Lote</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreateForm(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

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
            // Formata data para BR
            const createdAt = (l as any).created_at;
            const dateStr = createdAt ? new Date(createdAt).toLocaleString('pt-BR') : '-';
            return (
              <li key={l.id}>
                {i + 1}. <Link className="lot-title-highlight" href={`/admin/lots/${l.id}`}>{(l.title || `Lote #${l.id}`).toUpperCase()}</Link> | Empresa {org?.name || l.organization_id} | Status {statusLabel(l.status)} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining} | Criado: {dateStr}
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
