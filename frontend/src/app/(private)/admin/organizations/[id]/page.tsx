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
  issue_window_days?: number;
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

function normalizeDateForApi(value?: string) {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }

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

  function setApiError(prefix: string, err: unknown) {
    const msg = err instanceof Error ? err.message : prefix;
    setMessage(msg || prefix);
  }

  async function loadAll() {
    const [orgsRes, lotsRes, notesRes, credsRes] = await Promise.allSettled([
      apiGet("/api/v1/organizations"),
      apiGet("/api/v1/lots"),
      apiGet(`/api/v1/organization-notes/${orgId}`),
      apiGet(`/api/v1/credentials?organization_id=${orgId}`),
    ]);

    if (orgsRes.status === "fulfilled") {
      const foundOrg =
        ((orgsRes.value as Org[]) || []).find((o) => o.id === orgId) || null;
      setOrg(foundOrg);
    } else {
      console.error("Erro ao carregar organização:", orgsRes.reason);
      setOrg(null);
    }

    if (lotsRes.status === "fulfilled") {
      setLots(
        ((lotsRes.value as Lot[]) || []).filter((l) => l.organization_id === orgId)
      );
    } else {
      console.error("Erro ao carregar lotes:", lotsRes.reason);
      setLots([]);
    }

    if (notesRes.status === "fulfilled") {
      setNotesList((notesRes.value as Note[]) || []);
    } else {
      console.error("Erro ao carregar anotações:", notesRes.reason);
      setNotesList([]);
    }

    if (credsRes.status === "fulfilled") {
      setCredentials((credsRes.value as Cred[]) || []);
    } else {
      console.error("Erro ao carregar credenciais:", credsRes.reason);
      setCredentials([]);
    }
  }

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    loadAll().catch((e) => {
      console.error("Erro geral na página de organização:", e);
      setMessage("Erro ao carregar a organização.");
    });
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

      setEditName(data.razao_social?.trim() || data.nome_fantasia?.trim() || editName);

      const fullAddress = joinAddress(data);
      if (fullAddress) setEditAddress(fullAddress);

      if (data.cnae_fiscal_descricao) setEditCnae(data.cnae_fiscal_descricao);
      if (data.data_inicio_atividade) setEditOpeningDate(data.data_inicio_atividade);
      if (data.natureza_juridica) setEditRegime(data.natureza_juridica);

      setMessage("Dados do CNPJ carregados com sucesso.");
    } catch (e) {
      setApiError("Erro ao consultar CNPJ.", e);
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
      setApiError("Erro ao executar migração.", e);
    } finally {
      setIsBusy(false);
    }
  }

  async function deactivateOrganization() {
    if (!org) return;
    const ok = window.confirm(`Tem certeza que deseja pausar a organização ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/deactivate`, {});
      setMessage("Organização pausada com sucesso.");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao pausar organização.", e);
    }
  }

  async function activateOrganization() {
    if (!org) return;
    const ok = window.confirm(`Tem certeza que deseja ativar a organização ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/activate`, {});
      setMessage("Organização ativada com sucesso.");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao ativar organização.", e);
    }
  }

  async function deleteOrganization() {
    if (!org) return;
    const ok = window.confirm(`Tem certeza que deseja mover ${org.name} para a lixeira?`);
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}`);
      setMessage("Organização movida para lixeira.");
      await loadAll();
      setTab("trash");
    } catch (e) {
      setApiError("Erro ao mover para lixeira.", e);
    }
  }

  async function permanentDeleteOrganization() {
    if (!org) return;
    const ok = window.confirm(
      `Tem certeza que deseja excluir permanentemente ${org.name}? Esta ação não poderá ser desfeita.`
    );
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}?force=true`);
      router.push("/admin/organizations");
    } catch (e) {
      setApiError("Erro ao excluir permanentemente.", e);
    }
  }

  async function restoreOrganization() {
    if (!org) return;
    const ok = window.confirm(`Tem certeza que deseja restaurar ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/restore`, {});
      setMessage("Organização restaurada.");
      await loadAll();
      setTab("overview");
    } catch (e) {
      setApiError("Erro ao restaurar organização.", e);
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
    } catch (e) {
      setApiError("Erro ao salvar anotação.", e);
    }
  }

  async function removeNote(noteId: number) {
    const ok = window.confirm("Tem certeza que deseja remover esta anotação?");
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organization-notes/${noteId}`);
      await loadAll();
      setMessage("Anotação removida.");
    } catch (e) {
      setApiError("Erro ao remover anotação.", e);
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
      setApiError("Erro ao atualizar lote.", e);
    }
  }

  async function moveLotToTrash(l: Lot) {
    const ok = window.confirm(`Tem certeza que deseja mover o lote ${l.title || "#" + l.id} para a lixeira?`);
    if (!ok) return;
    await updateLot(l.id, { status: "trashed" });
  }

  async function revokeLotFlow(l: Lot) {
    const full = window.confirm(
      `Deseja revogar totalmente o lote ${l.title || "#" + l.id}?\n\nClique em OK para revogação total.\nClique em Cancelar para revogação parcial.`
    );

    if (full) {
      try {
        await apiPost(`/api/v1/lots/${l.id}/revoke`, { mode: "full" });
        await loadAll();
        setMessage("Lote revogado totalmente.");
      } catch (e) {
        setApiError("Erro ao revogar lote.", e);
      }
      return;
    }

    const qtyInput = window.prompt("Informe a quantidade para revogação parcial:", "1");
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty <= 0) return;

    try {
      await apiPost(`/api/v1/lots/${l.id}/revoke`, {
        mode: "partial",
        quantity: qty,
      });
      await loadAll();
      setMessage("Revogação parcial concluída.");
    } catch (e) {
      setApiError("Erro ao revogar lote parcialmente.", e);
    }
  }

  async function recoverLotFlow(l: Lot) {
    const ok = window.confirm(`Tem certeza que deseja recuperar o lote ${l.title || "#" + l.id}?`);
    if (!ok) return;

    const qtyInput = window.prompt("Quantidade para recuperar (opcional):", "0");
    const qty = qtyInput && !Number.isNaN(Number(qtyInput)) ? Number(qtyInput) : 0;

    try {
      await apiPost(`/api/v1/lots/${l.id}/recover`, {
        quantity: qty,
        to_status: "active",
      });
      await loadAll();
      setMessage("Lote recuperado com sucesso.");
    } catch (e) {
      setApiError("Erro ao recuperar lote.", e);
    }
  }

  async function updateCredential(credentialId: number, status: string) {
    try {
      await apiPatch(`/api/v1/credentials/${credentialId}`, { status });
      await loadAll();
      setMessage("Credencial atualizada.");
    } catch (e) {
      setApiError("Erro ao atualizar credencial.", e);
    }
  }

  async function trashCredential(credentialId: number) {
    const ok = window.confirm("Tem certeza que deseja mover esta credencial para a lixeira?");
    if (!ok) return;
    await updateCredential(credentialId, "trashed");
  }

  async function revokeCredential(credentialId: number) {
    const ok = window.confirm("Tem certeza que deseja revogar esta credencial?");
    if (!ok) return;
    await updateCredential(credentialId, "revoked");
  }

  function startEditing() {
    if (!org) return;
    setEditName(org.name);
    setEditDocument(org.document || "");
    setEditAddress(org.address || "");
    setEditCnae(org.cnae || "");
    setEditOpeningDate(org.opening_date ? formatDateBR(org.opening_date) : "");
    setEditRegime(org.regime || "");
    setIsEditing(true);
    setShowCreateLot(false);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await apiPatch(`/api/v1/organizations/${orgId}`, {
        name: editName.trim(),
        document: editDocument.trim(),
        address: editAddress.trim(),
        cnae: editCnae.trim(),
        opening_date: normalizeDateForApi(editOpeningDate),
        regime: editRegime.trim(),
      });
      setMessage("Organização atualizada com sucesso!");
      setIsEditing(false);
      await loadAll();
    } catch (e) {
      setApiError("Erro ao atualizar organização.", e);
    }
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();

    if (!org) {
      setMessage("Organização não encontrada.");
      return;
    }

    if (org.status === "trashed") {
      setMessage("Não é possível criar lote para organização na lixeira.");
      return;
    }

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
        title: lotTitle.trim() || `Lote ${new Date().toLocaleDateString("pt-BR")}`,
        description: lotDescription.trim(),
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
      setApiError("Erro ao criar lote.", e);
    }
  }

  const totalIssued = useMemo(
    () => lots.reduce((a, b) => a + (b.issued || 0), 0),
    [lots]
  );

  const totalRemaining = useMemo(
    () => lots.reduce((a, b) => a + (b.remaining || 0), 0),
    [lots]
  );

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organização</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            onClick={() => router.push("/admin/organizations")}
          >
            ← Voltar
          </button>
          <button
            className="btn-ghost"
            onClick={() => loadAll()}
          >
            Atualizar
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
        <p className={message.toLowerCase().includes("erro") ? "error" : "success"}>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    placeholder="Descrição do CNAE"
                  />
                </div>

                <div>
                  <label>Data de Abertura</label>
                  <input
                    value={editOpeningDate}
                    onChange={(e) => setEditOpeningDate(e.target.value)}
                    placeholder="DD/MM/AAAA ou AAAA-MM-DD"
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
              <button type="submit" disabled={isBusy}>
                Salvar Alterações
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={runOrganizationMigration}
                disabled={isBusy}
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
                <label>Organização</label>
                <input value={org.name} disabled />
              </div>

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

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="submit" disabled={isBusy}>
                Criar Lote
              </button>
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
                <strong>CNAE principal:</strong>
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

              {org.status !== "trashed" && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setShowCreateLot(true);
                    setIsEditing(false);
                  }}
                >
                  📦 Criar Lote
                </button>
              )}

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

              {org.status !== "trashed" && (
                <button className="btn-ghost" onClick={deleteOrganization}>
                  🗑️ Lixeira
                </button>
              )}

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
                    <strong>Total emitido:</strong> {totalIssued}
                  </p>
                  <p>
                    <strong>Saldo total:</strong> {totalRemaining}
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
                          {l.remaining} | Janela {l.issue_window_days || 0} dias
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
                            {l.remaining} | Janela {l.issue_window_days || 0} dias
                          </span>
                        </span>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn-ghost"
                            onClick={() => router.push(`/admin/lots/${l.id}`)}
                          >
                            Ver detalhes
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
                            onClick={() => moveLotToTrash(l)}
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
                            onClick={() => revokeCredential(c.id)}
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
                            onClick={() => trashCredential(c.id)}
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
                        Ver detalhes
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

                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn-ghost"
                            onClick={() => recoverLotFlow(l)}
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
