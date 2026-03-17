"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../../lib/api";
import { useAuth } from "../../../../../lib/auth-context";

type Org = {
  id: number;
  name: string;
  document?: string;
  status: string;
  address?: string;
  cnae?: string;
  opening_date?: string;
  regime?: string;
  created_at?: string;
};

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  description?: string;
  total_badges: number;
  issued: number;
  remaining: number;
  issue_window_days: number;
  status: string;
};

type Note = {
  id: number;
  organization_id: number;
  title: string;
  content: string;
  created_at?: string;
};

type Cred = {
  id: number;
  organization_id: number;
  lot_id: number;
  public_id: string;
  recipient_name: string;
  course_name: string;
  status: string;
};

type CnpjLookup = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  data_inicio_atividade?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  natureza_juridica?: string;
  cnae_fiscal_descricao?: string;
};

type TabKey = "overview" | "active" | "revoked" | "notes" | "trash";

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "#22c55e";
    case "paused":
      return "#f59e0b";
    case "inactive":
      return "#f59e0b";
    case "revoked":
      return "#ef4444";
    case "finished":
      return "#6b7280";
    case "trashed":
      return "#374151";
    default:
      return "#9ca3af";
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    paused: "Pausado",
    inactive: "Inativa",
    revoked: "Revogado",
    finished: "Finalizado",
    trashed: "Lixeira",
  };
  return map[status] || status;
}

function formatDateBR(value?: string) {
  if (!value) return "não informado";
  const v = value.trim();
  if (!v) return "não informado";

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;

  return v;
}

function joinAddress(data: CnpjLookup) {
  const parts = [
    data.logradouro,
    data.numero,
    data.bairro,
    data.complemento,
    data.municipio,
    data.uf,
    data.cep,
  ]
    .map((x) => (x || "").trim())
    .filter(Boolean);

  return parts.join(", ");
}

export default function OrganizationDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [credentials, setCredentials] = useState<Cred[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [noteTitle, setNoteTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCnae, setEditCnae] = useState("");
  const [editOpeningDate, setEditOpeningDate] = useState("");
  const [editRegime, setEditRegime] = useState("");

  const [showCreateLot, setShowCreateLot] = useState(false);
  const [lotTitle, setLotTitle] = useState("");
  const [lotDescription, setLotDescription] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [lotIssueWindowDays, setLotIssueWindowDays] = useState("365");

  const orgId = Number(params.id);

  async function loadAll() {
    try {
      const orgs = await apiGet("/api/v1/organizations");
      const foundOrg = ((orgs as Org[]) || []).find((o) => o.id === orgId) || null;
      setOrg(foundOrg);
    } catch (e) {
      console.error("Erro ao carregar organização:", e);
      setOrg(null);
    }

    try {
      const allLots = await apiGet("/api/v1/lots");
      setLots(((allLots as Lot[]) || []).filter((l) => l.organization_id === orgId));
    } catch (e) {
      console.error("Erro ao carregar lotes:", e);
      setLots([]);
    }

    try {
      const allNotes = await apiGet(`/api/v1/organization-notes/${orgId}`);
      setNotesList((allNotes as Note[]) || []);
    } catch (e) {
      console.error("Erro ao carregar anotações:", e);
      setNotesList([]);
    }

    try {
      const creds = await apiGet(`/api/v1/credentials?organization_id=${orgId}`);
      setCredentials((creds as Cred[]) || []);
    } catch (e) {
      console.error("Erro ao carregar credenciais:", e);
      setCredentials([]);
    }
  }

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    loadAll();
  }, [user, isLoading, orgId, router]);

  const activeLots = useMemo(
    () => lots.filter((l) => l.status === "active" || l.status === "paused"),
    [lots]
  );

  const revokedLots = useMemo(
    () => lots.filter((l) => l.status === "revoked" || l.status === "finished"),
    [lots]
  );

  const trashedLots = useMemo(
    () => lots.filter((l) => l.status === "trashed"),
    [lots]
  );

  const trashedCreds = useMemo(
    () => credentials.filter((c) => c.status === "trashed"),
    [credentials]
  );

  async function lookupCnpjAndFill() {
    const raw = (editDocument || "").replace(/\D/g, "");
    if (raw.length !== 14) {
      setMessage("Informe um CNPJ válido com 14 dígitos.");
      return;
    }

    setIsBusy(true);
    try {
      const data = (await apiGet(`/api/v1/organizations/cnpj/${raw}`)) as CnpjLookup;

      setEditName(
        data.razao_social?.trim() ||
          data.nome_fantasia?.trim() ||
          editName
      );

      const fullAddress = joinAddress(data);
      if (fullAddress) setEditAddress(fullAddress);

      if (data.cnae_fiscal_descricao) setEditCnae(data.cnae_fiscal_descricao);
      if (data.data_inicio_atividade) setEditOpeningDate(data.data_inicio_atividade);
      if (data.natureza_juridica) setEditRegime(data.natureza_juridica);

      setMessage("Dados do CNPJ carregados com sucesso.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar CNPJ.";
      setMessage(msg);
    } finally {
      setIsBusy(false);
    }
  }

  async function runOrganizationMigration() {
    setIsBusy(true);
    try {
      await apiPost("/api/v1/organizations/migrate/add-fields", {});
      setMessage("Migração executada com sucesso. Agora salve novamente a organização.");
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao executar migração.";
      setMessage(msg);
    } finally {
      setIsBusy(false);
    }
  }

  async function deactivateOrganization() {
    if (!org) return;
    const ok = window.confirm(`Pausar organização ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/deactivate`, {});
      setMessage("Organização pausada com sucesso.");
      await loadAll();
    } catch {
      setMessage("Erro ao pausar organização.");
    }
  }

  async function activateOrganization() {
    if (!org) return;
    const ok = window.confirm(`Ativar organização ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/activate`, {});
      setMessage("Organização ativada com sucesso.");
      await loadAll();
    } catch {
      setMessage("Erro ao ativar organização.");
    }
  }

  async function deleteOrganization() {
    if (!org) return;
    const ack = window.prompt(
      `Mover organização ${org.name} para lixeira. Digite EXCLUIR para confirmar:`
    );
    if (ack !== "EXCLUIR") return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}`);
      setMessage("Organização movida para lixeira.");
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao mover para lixeira.";
      setMessage(msg);
    }
  }

  async function permanentDeleteOrganization() {
    if (!org) return;
    const ack = window.prompt(
      `EXCLUSÃO PERMANENTE de ${org.name}. Digite APAGAR PERMANENTEMENTE para confirmar:`
    );
    if (ack !== "APAGAR PERMANENTEMENTE") return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}?force=true`);
      setMessage("Organização excluída permanentemente.");
      router.push("/admin/organizations");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Erro ao excluir permanentemente.";
      setMessage(msg);
    }
  }

  async function restoreOrganization() {
    if (!org) return;
    try {
      await apiPost(`/api/v1/organizations/${org.id}/restore`, {});
      setMessage("Organização restaurada.");
      await loadAll();
    } catch {
      setMessage("Erro ao restaurar organização.");
    }
  }

  async function saveNote() {
    if (!notes.trim()) return;

    try {
      await apiPost(`/api/v1/organization-notes/${orgId}`, {
        title: noteTitle || null,
        content: notes,
      });
      setMessage("Anotação salva.");
      setNoteTitle("");
      setNotes("");
      await loadAll();
    } catch {
      setMessage("Erro ao salvar anotação.");
    }
  }

  async function removeNote(noteId: number) {
    if (!window.confirm("Remover anotação?")) return;

    try {
      await apiDelete(`/api/v1/organization-notes/${noteId}`);
      await loadAll();
      setMessage("Anotação removida.");
    } catch {
      setMessage("Erro ao remover anotação.");
    }
  }

  async function updateLot(
    lotId: number,
    patch: { total_badges?: number; status?: string }
  ) {
    try {
      await apiPatch(`/api/v1/lots/${lotId}`, patch);
      await loadAll();
      setMessage("Lote atualizado.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar lote.";
      setMessage(msg);
    }
  }

  async function revokeLotFlow(l: Lot) {
    const mode = window.prompt(
      "Tipo de revogação: FULL (total) ou PARTIAL (parcial)",
      "PARTIAL"
    );
    if (!mode) return;

    const up = mode.toUpperCase();

    if (up === "FULL") {
      const ack = window.prompt("Digite REVOGAR para confirmar revogação TOTAL");
      if (ack !== "REVOGAR") return;

      await apiPost(`/api/v1/lots/${l.id}/revoke`, { mode: "full" });
      await loadAll();
      setMessage("Lote revogado totalmente.");
      return;
    }

    const qtyInput = window.prompt(
      "Quantidade a revogar (somente saldo não emitido)",
      "1"
    );
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty <= 0) return;

    const ack = window.prompt(
      `Digite REVOGAR para confirmar revogação parcial de ${qty}`
    );
    if (ack !== "REVOGAR") return;

    await apiPost(`/api/v1/lots/${l.id}/revoke`, {
      mode: "partial",
      quantity: qty,
    });
    await loadAll();
    setMessage("Revogação parcial concluída.");
  }

  async function recoverLotFlow(l: Lot) {
    const ack = window.prompt(
      `Digite RECUPERAR para confirmar recuperação do lote ${l.title || "#" + l.id}`
    );
    if (ack !== "RECUPERAR") return;

    const qtyInput = window.prompt("Quantidade para recuperar (opcional)", "0");
    const qty =
      qtyInput && !Number.isNaN(Number(qtyInput)) ? Number(qtyInput) : 0;

    await apiPost(`/api/v1/lots/${l.id}/recover`, {
      quantity: qty,
      to_status: "active",
    });
    await loadAll();
    setMessage("Lote recuperado com sucesso.");
  }

  async function updateCredential(credentialId: number, status: string) {
    try {
      await apiPatch(`/api/v1/credentials/${credentialId}`, { status });
      await loadAll();
      setMessage("Credencial atualizada.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar credencial.";
      setMessage(msg);
    }
  }

  function startEditing() {
    if (!org) return;
    setEditName(org.name);
    setEditDocument(org.document || "");
    setEditAddress(org.address || "");
    setEditCnae(org.cnae || "");
    setEditOpeningDate(org.opening_date || "");
    setEditRegime(org.regime || "");
    setIsEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await apiPatch(`/api/v1/organizations/${orgId}`, {
        name: editName,
        document: editDocument,
        address: editAddress,
        cnae: editCnae,
        opening_date: editOpeningDate,
        regime: editRegime,
      });
      setMessage("Organização atualizada com sucesso!");
      setIsEditing(false);
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar organização.";
      setMessage(msg);
    }
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();

    const qty = Number(lotQuantity);
    const issueWindow = Number(lotIssueWindowDays);

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
        title: lotTitle || `Lote ${new Date().toLocaleDateString("pt-BR")}`,
        description: lotDescription,
        total_badges: qty,
        issue_window_days: issueWindow,
      });

      setMessage("Lote criado com sucesso!");
      setShowCreateLot(false);
      setLotTitle("");
      setLotDescription("");
      setLotQuantity("");
      setLotIssueWindowDays("365");
      await loadAll();
      setTab("overview");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar lote.";
      setMessage(msg);
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organização</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() => router.push("/admin/organizations")}
          >
            ← Voltar
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {!org && <p className="error">Organização não encontrada.</p>}

      {message && (
        <p className={message.includes("Erro") ? "error" : "success"}>
          {message}
        </p>
      )}

      {isEditing && org && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>Editar Organização</h2>
          <form onSubmit={saveEdit}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label>Razão Social</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>CNPJ</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={editDocument}
                    onChange={(e) => setEditDocument(e.target.value)}
                    placeholder="Somente números ou CNPJ formatado"
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={lookupCnpjAndFill}
                    disabled={isBusy}
                  >
                    Buscar CNPJ
                  </button>
                </div>
              </div>

              <div>
                <label>Endereço</label>
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
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
                  <label>CNAE Principal</label>
                  <input
                    value={editCnae}
                    onChange={(e) => setEditCnae(e.target.value)}
                  />
                </div>

                <div>
                  <label>Data de Abertura</label>
                  <input
                    value={editOpeningDate}
                    onChange={(e) => setEditOpeningDate(e.target.value)}
                    placeholder="AAAA-MM-DD ou DD/MM/AAAA"
                  />
                </div>
              </div>

              <div>
                <label>Natureza Jurídica</label>
                <input
                  value={editRegime}
                  onChange={(e) => setEditRegime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="submit">Salvar Alterações</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={runOrganizationMigration}
              >
                Rodar migração
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {showCreateLot && org && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>Criar Lote</h2>
          <form onSubmit={createLot}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label>Título do Lote (opcional)</label>
                <input
                  value={lotTitle}
                  onChange={(e) => setLotTitle(e.target.value)}
                  placeholder="Ex: Lote Março 2026"
                />
              </div>

              <div>
                <label>Descrição (opcional)</label>
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
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit">Criar Lote</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowCreateLot(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {org && (
        <>
          <section className="card">
            <h2>{org.name}</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
                marginBottom: "20px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div>
                <strong>ID:</strong>
                <div>#{org.id}</div>
              </div>

              <div>
                <strong>CNPJ:</strong>
                <div>{org.document || "não informado"}</div>
              </div>

              <div>
                <strong>Status:</strong>
                <div>{getStatusLabel(org.status)}</div>
              </div>

              <div>
                <strong>Endereço:</strong>
                <div>{org.address || "não informado"}</div>
              </div>

              <div>
                <strong>CNAE:</strong>
                <div>{org.cnae || "não informado"}</div>
              </div>

              <div>
                <strong>Data de abertura:</strong>
                <div>{formatDateBR(org.opening_date)}</div>
              </div>

              <div>
                <strong>Natureza / regime:</strong>
                <div>{org.regime || "não informado"}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-ghost" onClick={startEditing}>
                ✏️ Editar
              </button>

              <button
                className="btn-ghost"
                onClick={() => setShowCreateLot(true)}
              >
                📦 Criar Lote
              </button>

              {org.status === "active" ? (
                <button className="btn-ghost" onClick={deactivateOrganization}>
                  ⏸️ Pausar
                </button>
              ) : org.status === "trashed" ? (
                <button className="btn-ghost" onClick={restoreOrganization}>
                  🔄 Restaurar
                </button>
              ) : (
                <button className="btn-ghost" onClick={activateOrganization}>
                  ▶️ Ativar
                </button>
              )}

              <button className="btn-ghost" onClick={deleteOrganization}>
                🗑️ Lixeira
              </button>

              {org.status === "trashed" && (
                <button
                  className="btn-ghost"
                  onClick={permanentDeleteOrganization}
                >
                  ❌ Excluir permanentemente
                </button>
              )}
            </div>
          </section>

          <section className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                className={tab === "overview" ? "btn-active" : "btn-ghost"}
                onClick={() => setTab("overview")}
              >
                Visão geral
              </button>

              <button
                className={tab === "active" ? "btn-active" : "btn-ghost"}
                onClick={() => setTab("active")}
              >
                Lotes ativos
              </button>

              <button
                className={tab === "revoked" ? "btn-active" : "btn-ghost"}
                onClick={() => setTab("revoked")}
              >
                Lotes revogados/finalizados
              </button>

              <button
                className={tab === "notes" ? "btn-active" : "btn-ghost"}
                onClick={() => setTab("notes")}
              >
                Anotações
              </button>

              <button
                className={tab === "trash" ? "btn-active" : "btn-ghost"}
                onClick={() => setTab("trash")}
              >
                Lixeira
              </button>
            </div>

            {tab === "overview" && (
              <div className="form-grid">
                <div>
                  <p>
                    <strong>Total de lotes:</strong> {lots.length}
                  </p>
                  <p>
                    <strong>Total emitido:</strong>{" "}
                    {lots.reduce((a, b) => a + b.issued, 0)}
                  </p>
                  <p>
                    <strong>Saldo total:</strong>{" "}
                    {lots.reduce((a, b) => a + b.remaining, 0)}
                  </p>
                </div>

                <div className="card" style={{ marginBottom: 0 }}>
                  <h2 style={{ fontSize: 16 }}>Lotes da organização ({lots.length})</h2>
                  <ul className="list">
                    {lots.map((l, i) => (
                      <li key={l.id}>
                        {i + 1}.{" "}
                        <Link
                          className="lot-title-highlight"
                          href={`/admin/lots/${l.id}`}
                        >
                          {l.title || `Lote #${l.id}`}
                        </Link>

                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            background: getStatusColor(l.status) + "20",
                            color: getStatusColor(l.status),
                            border: `1px solid ${getStatusColor(l.status)}`,
                          }}
                        >
                          {getStatusLabel(l.status)}
                        </span>

                        <span className="muted">
                          {" "}
                          | Total {l.total_badges} | Emitidos {l.issued} | Saldo{" "}
                          {l.remaining}
                        </span>

                        {l.description ? <p className="muted">{l.description}</p> : null}
                      </li>
                    ))}
                    {!lots.length && <li>Nenhum lote cadastrado.</li>}
                  </ul>
                </div>
              </div>
            )}

            {tab === "active" && (
              <div className="form-grid">
                <ul className="list">
                  {activeLots.map((l) => (
                    <li key={l.id}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span>
                          <Link
                            className="lot-title-highlight"
                            href={`/admin/lots/${l.id}`}
                          >
                            {(l.title || `Lote #${l.id}`).toUpperCase()}
                          </Link>

                          <span
                            style={{
                              marginLeft: 8,
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              background: getStatusColor(l.status) + "20",
                              color: getStatusColor(l.status),
                              border: `1px solid ${getStatusColor(l.status)}`,
                            }}
                          >
                            {getStatusLabel(l.status)}
                          </span>

                          <span className="muted">
                            {" "}
                            | Total {l.total_badges} | Emitidos {l.issued} | Saldo{" "}
                            {l.remaining}
                          </span>
                        </span>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn-ghost"
                            onClick={() => router.push(`/admin/lots/${l.id}`)}
                          >
                            Editar quantidade
                          </button>

                          {l.status === "active" ? (
                            <button
                              className="btn-ghost"
                              onClick={() => updateLot(l.id, { status: "paused" })}
                            >
                              Pausar lote
                            </button>
                          ) : (
                            <button
                              className="btn-ghost"
                              onClick={() => updateLot(l.id, { status: "active" })}
                            >
                              Ativar lote
                            </button>
                          )}

                          <button className="btn-ghost" onClick={() => revokeLotFlow(l)}>
                            Revogar lote
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => {
                              const ack = window.prompt(
                                "Digite EXCLUIR para enviar lote à lixeira"
                              );
                              if (ack !== "EXCLUIR") return;
                              updateLot(l.id, { status: "trashed" });
                            }}
                          >
                            Lixeira
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                  {!activeLots.length && <li>Nenhum lote ativo/pausado.</li>}
                </ul>

                <div className="card" style={{ marginBottom: 0 }}>
                  <h2 style={{ fontSize: 16 }}>Credenciais emitidas desta organização</h2>
                  <ul className="list">
                    {credentials.map((c) => (
                      <li key={c.id}>
                        {c.recipient_name} | {c.course_name} | status: {c.status}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          <button
                            className="btn-ghost"
                            onClick={() => updateCredential(c.id, "paused")}
                          >
                            Pausar
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => {
                              const ack = window.prompt(
                                "Digite REVOGAR para confirmar revogação da credencial"
                              );
                              if (ack !== "REVOGAR") return;
                              updateCredential(c.id, "revoked");
                            }}
                          >
                            Revogar
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => updateCredential(c.id, "valid")}
                          >
                            Ativar
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => {
                              const ack = window.prompt(
                                "Digite EXCLUIR para mover a credencial para lixeira"
                              );
                              if (ack !== "EXCLUIR") return;
                              updateCredential(c.id, "trashed");
                            }}
                          >
                            Lixeira
                          </button>
                        </div>
                      </li>
                    ))}
                    {!credentials.length && <li>Nenhuma credencial emitida ainda.</li>}
                  </ul>
                </div>
              </div>
            )}

            {tab === "revoked" && (
              <ul className="list">
                {revokedLots.map((l) => (
                  <li key={l.id}>
                    <Link
                      className="lot-title-highlight"
                      href={`/admin/lots/${l.id}`}
                    >
                      {l.title || `Lote #${l.id}`}
                    </Link>

                    <span
                      style={{
                        marginLeft: 8,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        background: getStatusColor(l.status) + "20",
                        color: getStatusColor(l.status),
                        border: `1px solid ${getStatusColor(l.status)}`,
                      }}
                    >
                      {getStatusLabel(l.status)}
                    </span>

                    <span className="muted">
                      {" "}
                      | Emitidos {l.issued} | Total {l.total_badges}
                    </span>

                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn-ghost"
                        onClick={() => router.push(`/admin/lots/${l.id}`)}
                      >
                        Editar quantidade
                      </button>

                      <button
                        className="btn-ghost"
                        onClick={() => recoverLotFlow(l)}
                      >
                        Recuperar lote
                      </button>
                    </div>
                  </li>
                ))}
                {!revokedLots.length && <li>Nenhum lote revogado/finalizado.</li>}
              </ul>
            )}

            {tab === "notes" && (
              <div className="form-grid" style={{ maxWidth: 760 }}>
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Título (opcional)"
                />

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas desta organização..."
                  style={{
                    minHeight: 140,
                    borderRadius: 8,
                    padding: 10,
                    background: "#0a163e",
                    color: "#fff",
                    border: "1px solid #2a3b73",
                  }}
                />

                <button onClick={saveNote}>Salvar anotação</button>

                <p className="muted">Total de anotações: {notesList.length}</p>

                <ul className="list">
                  {notesList.map((n, i) => (
                    <li key={n.id}>
                      <strong>
                        {i + 1}. {n.title}
                      </strong>{" "}
                      <span className="muted">
                        ({n.created_at?.slice(0, 10) || "-"})
                      </span>
                      <p>{n.content}</p>
                      <button
                        className="btn-ghost"
                        onClick={() => removeNote(n.id)}
                      >
                        Excluir anotação
                      </button>
                    </li>
                  ))}
                  {!notesList.length && <li>Nenhuma anotação salva.</li>}
                </ul>
              </div>
            )}

            {tab === "trash" && (
              <div className="form-grid">
                <div className="card" style={{ marginBottom: 0 }}>
                  <h2 style={{ fontSize: 16 }}>Lotes na lixeira</h2>
                  <ul className="list">
                    {trashedLots.map((l) => (
                      <li key={l.id}>
                        <Link
                          className="lot-title-highlight"
                          href={`/admin/lots/${l.id}`}
                        >
                          {l.title || `Lote #${l.id}`}
                        </Link>

                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            background: getStatusColor(l.status) + "20",
                            color: getStatusColor(l.status),
                            border: `1px solid ${getStatusColor(l.status)}`,
                          }}
                        >
                          {getStatusLabel(l.status)}
                        </span>

                        <span className="muted">
                          {" "}
                          | Total {l.total_badges} | Emitidos {l.issued}
                        </span>

                        <div style={{ marginTop: 6 }}>
                          <button
                            className="btn-ghost"
                            onClick={() => updateLot(l.id, { status: "active" })}
                          >
                            Restaurar lote
                          </button>
                        </div>
                      </li>
                    ))}
                    {!trashedLots.length && <li>Nenhum lote na lixeira.</li>}
                  </ul>
                </div>

                <div className="card" style={{ marginBottom: 0 }}>
                  <h2 style={{ fontSize: 16 }}>Credenciais na lixeira</h2>
                  <ul className="list">
                    {trashedCreds.map((c) => (
                      <li key={c.id}>
                        {c.recipient_name} | {c.course_name}
                        <div style={{ marginTop: 6 }}>
                          <button
                            className="btn-ghost"
                            onClick={() => updateCredential(c.id, "valid")}
                          >
                            Restaurar credencial
                          </button>
                        </div>
                      </li>
                    ))}
                    {!trashedCreds.length && <li>Nenhuma credencial na lixeira.</li>}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
