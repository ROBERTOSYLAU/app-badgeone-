"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  description?: string;
  total_badges: number;
  issued: number;
  remaining: number;
  issue_window_days?: number;
  status: string;
  created_at?: string;
};

type Org = {
  id: number;
  name: string;
  status?: string;
  document?: string;
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    paused: "Pausado",
    inactive: "Inativo",
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

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: "#22c55e",
    paused: "#f59e0b",
    inactive: "#9ca3af",
    revoked: "#ef4444",
    finished: "#6b7280",
    trashed: "#374151",
  };
  return map[status] || "#9ca3af";
}

function formatDateBR(value?: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleString("pt-BR");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

export default function AdminLotsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [recoverQtyByLot, setRecoverQtyByLot] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [lotTitle, setLotTitle] = useState("");
  const [lotDescription, setLotDescription] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [lotIssueWindowDays, setLotIssueWindowDays] = useState("365");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [lRes, oRes] = await Promise.all([
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/organizations"),
      ]);

      setLots((lRes as Lot[]) || []);
      setOrgs((oRes as Org[]) || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar dados de lotes.";
      setMessage(msg);
      setLots([]);
      setOrgs([]);
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

    loadData();
  }, [user, isLoading, router]);

  async function createLot(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const qty = Number(lotQuantity);
    const issueWindow = Number(lotIssueWindowDays);
    const orgId = Number(selectedOrg);

    if (!selectedOrg || Number.isNaN(orgId) || orgId <= 0) {
      setMessage("Selecione uma organização válida.");
      return;
    }

    if (!qty || qty <= 0) {
      setMessage("Quantidade deve ser maior que 0.");
      return;
    }

    if (!issueWindow || issueWindow <= 0) {
      setMessage("Janela de emissão deve ser maior que 0.");
      return;
    }

    try {
      await apiPost("/api/v1/lots", {
        organization_id: orgId,
        title: lotTitle.trim() || `Lote ${new Date().toLocaleDateString("pt-BR")}`,
        description: lotDescription.trim() || null,
        total_badges: qty,
        issue_window_days: issueWindow,
      });

      setMessage("Lote criado com sucesso!");
      setShowCreateForm(false);
      setLotTitle("");
      setLotDescription("");
      setLotQuantity("");
      setLotIssueWindowDays("365");
      setSelectedOrg("");
      await loadData();
      setStatus("all");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar lote.";
      setMessage(msg);
    }
  }

  async function restoreLot(lot: Lot) {
    const ok = window.confirm(`Tem certeza que deseja recuperar o lote ${lot.title || "#" + lot.id}?`);
    if (!ok) return;

    const qty = recoverQtyByLot[lot.id] ?? 0;

    try {
      await apiPost(`/api/v1/lots/${lot.id}/recover`, {
        quantity: qty,
        to_status: "active",
      });
      setMessage("Lote recuperado com sucesso.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao recuperar lote.";
      setMessage(msg);
    }
  }

  async function pauseLot(lotId: number) {
    try {
      await apiPatch(`/api/v1/lots/${lotId}`, { status: "paused" });
      setMessage("Lote pausado.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao pausar lote.";
      setMessage(msg);
    }
  }

  async function activateLot(lotId: number) {
    try {
      await apiPatch(`/api/v1/lots/${lotId}`, { status: "active" });
      setMessage("Lote ativado.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao ativar lote.";
      setMessage(msg);
    }
  }

  async function trashLot(lotId: number) {
    const ok = window.confirm("Tem certeza que deseja mover este lote para a lixeira?");
    if (!ok) return;

    try {
      await apiPatch(`/api/v1/lots/${lotId}`, { status: "trashed" });
      setMessage("Lote movido para a lixeira.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao mover lote para a lixeira.";
      setMessage(msg);
    }
  }

  const filtered = useMemo(
    () => (status === "all" ? lots : lots.filter((l) => l.status === status)),
    [lots, status]
  );

  const availableOrganizations = useMemo(
    () => orgs.filter((o) => o.status !== "trashed"),
    [orgs]
  );

  if (loading) {
    return (
      <main className="container">
        <div className="card">
          <h1>Lotes</h1>
          <p>Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Lotes ({titleByFilter(status)})</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? "Cancelar" : "+ Criar Lote"}
          </button>
          <button className="btn-ghost" onClick={() => loadData()}>
            Atualizar
          </button>
          <button className="btn-ghost" onClick={() => router.back()}>
            ← Voltar
          </button>
        </div>
      </div>

      {message && (
        <p className={message.toLowerCase().includes("falhou") || message.toLowerCase().includes("erro") ? "error" : "success"}>
          {message}
        </p>
      )}

      {showCreateForm && (
        <section className="card">
          <h2>Novo Lote</h2>

          <form onSubmit={createLot} style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Organização *</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  background: "#0a163e",
                  color: "#fff",
                  border: "1px solid #2a3b73",
                }}
              >
                <option value="">Selecione uma organização</option>
                {availableOrganizations.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.name} {o.document ? `| ${o.document}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Título do Lote</label>
              <input
                value={lotTitle}
                onChange={(e) => setLotTitle(e.target.value)}
                placeholder="Ex: Lote Março 2026"
              />
            </div>

            <div>
              <label>Descrição</label>
              <input
                value={lotDescription}
                onChange={(e) => setLotDescription(e.target.value)}
                placeholder="Descrição do lote"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label>Quantidade de Badges *</label>
                <input
                  type="number"
                  value={lotQuantity}
                  onChange={(e) => setLotQuantity(e.target.value)}
                  placeholder="100"
                  required
                  min="1"
                />
              </div>

              <div>
                <label>Janela de emissão em dias *</label>
                <input
                  type="number"
                  value={lotIssueWindowDays}
                  onChange={(e) => setLotIssueWindowDays(e.target.value)}
                  placeholder="365"
                  required
                  min="1"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit">Criar Lote</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className={status === "all" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("all")}>
            Todos
          </button>
          <button className={status === "active" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("active")}>
            Ativos
          </button>
          <button className={status === "paused" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("paused")}>
            Pausados
          </button>
          <button className={status === "revoked" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("revoked")}>
            Revogados
          </button>
          <button className={status === "finished" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("finished")}>
            Finalizados
          </button>
          <button className={status === "trashed" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("trashed")}>
            Lixeira
          </button>
        </div>

        <ul className="list">
          {filtered.map((l, i) => {
            const org = orgs.find((o) => o.id === l.organization_id);

            return (
              <li key={l.id}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <strong>
                      {i + 1}. {(l.title || `Lote #${l.id}`).toUpperCase()}
                    </strong>

                    <span
                      style={{
                        marginLeft: 8,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        background: statusColor(l.status) + "20",
                        color: statusColor(l.status),
                        border: `1px solid ${statusColor(l.status)}`,
                      }}
                    >
                      {statusLabel(l.status)}
                    </span>
                  </div>

                  <div className="muted">
                    Empresa: {org?.name || `#${l.organization_id}`} | Total: {l.total_badges} | Emitidos: {l.issued} | Saldo: {l.remaining} | Janela: {l.issue_window_days || 0} dias | Criado: {formatDateBR(l.created_at)}
                  </div>

                  {l.description ? <div className="muted">{l.description}</div> : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link className="btn-ghost" href={`/admin/lots/${l.id}`}>
                      Ver detalhes
                    </Link>

                    {l.status === "active" && (
                      <button className="btn-ghost" onClick={() => pauseLot(l.id)}>
                        Pausar
                      </button>
                    )}

                    {l.status === "paused" && (
                      <button className="btn-ghost" onClick={() => activateLot(l.id)}>
                        Ativar
                      </button>
                    )}

                    {l.status !== "trashed" && (
                      <button className="btn-ghost" onClick={() => trashLot(l.id)}>
                        Lixeira
                      </button>
                    )}
                  </div>

                  {(l.status === "revoked" || l.status === "trashed") && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Qtd recuperar"
                        value={recoverQtyByLot[l.id] ?? ""}
                        onChange={(e) =>
                          setRecoverQtyByLot((prev) => ({
                            ...prev,
                            [l.id]: Number(e.target.value),
                          }))
                        }
                        style={{ maxWidth: 160 }}
                      />
                      <button className="btn-ghost" onClick={() => restoreLot(l)}>
                        Recuperar lote
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}

          {!filtered.length && <li>Nenhum lote encontrado.</li>}
        </ul>
      </section>
    </main>
  );
}
