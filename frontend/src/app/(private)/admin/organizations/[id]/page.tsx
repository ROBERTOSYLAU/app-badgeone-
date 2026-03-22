"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  created_at?: string;
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
  cnae_fiscal?: string;
  cnae_fiscal_descricao?: string;
};

type TabKey = "overview" | "active" | "revoked" | "notes" | "trash";

type IssuerUser = {
  id: number;
  name: string;
  email: string;
  status: string;
  role?: string;
  password_is_default?: boolean;
};

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

function shortText(value?: string, max = 80) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function OrganizationDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const lotFormRef = useRef<HTMLDivElement | null>(null);

  const [org, setOrg] = useState<Org | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [credentials, setCredentials] = useState<Cred[]>([]);
  const [issuerUser, setIssuerUser] = useState<IssuerUser | null>(null);
  const [editingIssuerEmail, setEditingIssuerEmail] = useState(false);
  const [issuerEmailDraft, setIssuerEmailDraft] = useState("");
  const [editingIssuerPassword, setEditingIssuerPassword] = useState(false);
  const [issuerPasswordDraft, setIssuerPasswordDraft] = useState("");
  const [showIssuerLogin, setShowIssuerLogin] = useState(true);
  const [showIssuerPassword, setShowIssuerPassword] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);
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
  const [lotValidityMode, setLotValidityMode] = useState<"days" | "months" | "range">("days");
  const [lotDays, setLotDays] = useState("365");
  const [lotMonths, setLotMonths] = useState("");
  const [lotRangeStart, setLotRangeStart] = useState("");
  const [lotRangeEnd, setLotRangeEnd] = useState("");

  function computeLotDays(): number {
    if (lotValidityMode === "days") return parseInt(lotDays) || 0;
    if (lotValidityMode === "months") return (parseInt(lotMonths) || 0) * 30;
    if (lotValidityMode === "range" && lotRangeStart && lotRangeEnd) {
      const diff = Math.ceil(
        (new Date(lotRangeEnd).getTime() - new Date(lotRangeStart).getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(0, diff);
    }
    return 0;
  }

  const orgId = Number(params.id);

  function setApiError(prefix: string, err: unknown) {
    const msg = err instanceof Error ? err.message : prefix;
    setMessage(msg || prefix);
  }

  async function loadAll() {
    const [orgsRes, lotsRes, notesRes, credsRes, usersRes] = await Promise.allSettled([
      apiGet("/api/v1/organizations"),
      apiGet("/api/v1/lots"),
      apiGet(`/api/v1/organization-notes/${orgId}`),
      apiGet(`/api/v1/credentials?organization_id=${orgId}`),
      apiGet(`/api/v1/users?organization_id=${orgId}`),
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

    // Carrega emissor — tenta via lista de usuários primeiro, depois ensure-issuer
    let foundIssuer: IssuerUser | null = null;

    if (usersRes.status === "fulfilled") {
      const allUsers = (usersRes.value as any[]) || [];
      foundIssuer = allUsers.find((u: any) => u.role === "issuer") || null;
    }

    if (foundIssuer) {
      setIssuerUser(foundIssuer);
    } else {
      // Auto-provisiona emissor padrão se não existir ou se API falhou
      try {
        const created = await apiPost(`/api/v1/organizations/${orgId}/ensure-issuer`, {}) as any;
        setIssuerUser({
          id: created.id,
          name: created.name || "",
          email: created.email || "",
          status: created.status || "active",
          role: "issuer",
          password_is_default: created.password_is_default ?? true,
        });
      } catch {
        setIssuerUser(null);
      }
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  async function resetIssuerPassword() {
    if (!issuerUser) return;
    if (!confirm(`Redefinir a senha de "${issuerUser.email}" para Emissor123?`)) return;
    try {
      await apiPost(`/api/v1/users/${issuerUser.id}/reset-password`, {});
      setIssuerUser((prev) => prev ? { ...prev, password_is_default: true } : prev);
      setMessage("Senha redefinida para Emissor123.");
    } catch (e) {
      setApiError("Erro ao redefinir senha.", e);
    }
  }

  async function saveIssuerEmail() {
    if (!issuerUser || !issuerEmailDraft.trim()) return;
    try {
      const res = await apiPatch(`/api/v1/users/${issuerUser.id}`, { email: issuerEmailDraft.trim() }) as IssuerUser;
      setIssuerUser((prev) => prev ? { ...prev, email: res.email } : prev);
      setEditingIssuerEmail(false);
      setMessage("Login do emissor atualizado.");
    } catch (e) {
      setApiError("Erro ao atualizar login.", e);
    }
  }

  async function saveIssuerPassword() {
    if (!issuerUser || !issuerPasswordDraft.trim()) return;
    try {
      await apiPatch(`/api/v1/users/${issuerUser.id}`, { password: issuerPasswordDraft.trim() });
      setIssuerUser((prev) => prev ? { ...prev, password_is_default: false } : prev);
      setEditingIssuerPassword(false);
      setIssuerPasswordDraft("");
      setMessage("Senha do emissor atualizada pelo admin.");
    } catch (e) {
      setApiError("Erro ao atualizar senha.", e);
    }
  }

  async function createIssuer() {
    try {
      const res = await apiPost(`/api/v1/organizations/${orgId}/ensure-issuer`, {}) as IssuerUser & { password_is_default: boolean };
      await loadAll();
      setMessage(`Emissor criado: ${res.email}`);
    } catch (e) {
      setApiError("Erro ao criar emissor.", e);
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

      const cnaeCompleto = [data.cnae_fiscal, data.cnae_fiscal_descricao]
        .filter(Boolean)
        .join(" - ");
      if (cnaeCompleto) setEditCnae(cnaeCompleto);

      if (data.data_inicio_atividade) setEditOpeningDate(formatDateBR(data.data_inicio_atividade));
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
      `Deseja revogar totalmente o lote ${l.title || "#" + l.id}?\n\nOK = total\nCancelar = parcial`
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

  function openCreateLotForm() {
    setShowCreateLot(true);
    setIsEditing(false);
    setTimeout(() => {
      lotFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
    const issueWindow = computeLotDays();

    if (!qty || qty <= 0) {
      setMessage("Quantidade deve ser maior que 0.");
      return;
    }

    if (!issueWindow || issueWindow <= 0) {
      setMessage("Informe uma validade maior que zero.");
      return;
    }

    try {
      await apiPost("/api/v1/lots", {
        organization_id: orgId,
        title: lotTitle.trim() || `Lote ${new Date().toLocaleDateString("pt-BR")}`,
        description: lotDescription.trim(),
        total_badges: qty,
        issue_window_days: issueWindow,
        start_date: lotValidityMode === "range" ? lotRangeStart || undefined : undefined,
        end_date: lotValidityMode === "range" ? lotRangeEnd || undefined : undefined,
      });

      setMessage("Lote criado com sucesso!");
      setShowCreateLot(false);
      setLotTitle("");
      setLotDescription("");
      setLotQuantity("");
      setLotDays("365");
      setLotMonths("");
      setLotRangeStart("");
      setLotRangeEnd("");
      await loadAll();
      setTab("overview");
    } catch (e) {
      setApiError("Erro ao criar lote.", e);
    }
  }

  const totalIssued = useMemo(() => lots.reduce((a, b) => a + (b.issued || 0), 0), [lots]);
  const totalRemaining = useMemo(() => lots.reduce((a, b) => a + (b.remaining || 0), 0), [lots]);

  function maskName(name: string): string {
    if (!name) return "***";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0] + "***";
    return `${parts[0]} ${"*".repeat(parts[parts.length - 1].length)}`;
  }

  return (
    <main className="container">
      {/* ── Header ── */}
      <div className="header-row" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => router.back()}
          >
            ← Voltar
          </button>
          <h1 style={{ color: "var(--primary)", margin: 0, fontSize: 17 }}>
            {org?.name || "Organização"}
          </h1>
          {org && (
            <span style={{
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: `${getStatusColor(org.status)}18`,
              color: getStatusColor(org.status),
              border: `1px solid ${getStatusColor(org.status)}55`,
            }}>
              {getStatusLabel(org.status)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={startEditing}>
            ✏️ Editar
          </button>
          {org?.status !== "trashed" && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={openCreateLotForm}>
              + Criar Lote
            </button>
          )}
          {org?.status === "active" && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={deactivateOrganization}>
              Pausar
            </button>
          )}
          {(org?.status === "inactive" || org?.status === "paused") && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={activateOrganization}>
              Ativar
            </button>
          )}
          {org?.status === "trashed" && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={restoreOrganization}>
              Restaurar
            </button>
          )}
          {org?.status !== "trashed" && (
            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: "5px 10px", color: "#DC2626", borderColor: "#DC262640" }}
              onClick={deleteOrganization}
            >
              Lixeira
            </button>
          )}
          {org?.status === "trashed" && (
            <button
              style={{ fontSize: 12, padding: "5px 10px", background: "#DC2626", color: "white", borderRadius: 7, border: "none", cursor: "pointer" }}
              onClick={permanentDeleteOrganization}
            >
              Excluir permanentemente
            </button>
          )}
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "5px 8px" }}
            onClick={() => loadAll()}
            title="Atualizar"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Message ── */}
      {message && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 7,
          fontSize: 13,
          marginBottom: 10,
          background: message.toLowerCase().includes("erro") ? "#DC262610" : "#16A34A10",
          border: `1px solid ${message.toLowerCase().includes("erro") ? "#DC262630" : "#16A34A30"}`,
          color: message.toLowerCase().includes("erro") ? "#DC2626" : "#16A34A",
        }}>
          {message}
        </div>
      )}

      {!org && <p className="error">Organização não encontrada.</p>}

      {/* ── Edit form ── */}
      {isEditing && org && (
        <section className="card" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 13, marginBottom: 10, color: "var(--text)" }}>Editar Organização</h2>
          <form onSubmit={saveEdit}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Razão Social</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>CNPJ</label>
                  <div style={{ display: "flex", gap: 5 }}>
                    <input style={{ flex: 1 }} value={editDocument} onChange={(e) => setEditDocument(e.target.value)} />
                    <button type="button" className="btn-ghost" style={{ whiteSpace: "nowrap", fontSize: 11, padding: "0 9px" }} onClick={lookupCnpjAndFill} disabled={isBusy}>
                      Buscar
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Endereço</label>
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>CNAE</label>
                  <input value={editCnae} onChange={(e) => setEditCnae(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Abertura</label>
                  <input value={editOpeningDate} onChange={(e) => setEditOpeningDate(e.target.value)} placeholder="DD/MM/AAAA" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Natureza Jurídica</label>
                  <input value={editRegime} onChange={(e) => setEditRegime(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button type="submit" style={{ fontSize: 12, padding: "6px 14px", width: "auto" }} disabled={isBusy}>Salvar</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => setIsEditing(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {/* ── Create lot form ── */}
      {showCreateLot && org && (
        <section className="card" style={{ marginBottom: 10 }} ref={lotFormRef}>
          <h2 style={{ fontSize: 13, marginBottom: 10, color: "var(--text)" }}>Novo Lote — {org.name}</h2>
          <form onSubmit={createLot}>
            <div style={{ display: "grid", gap: 10 }}>
              {/* Title + Description */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lbl}>Título</label>
                  <input value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Ex: Lote Março 2026" />
                </div>
                <div>
                  <label style={lbl}>Descrição (opcional)</label>
                  <input value={lotDescription} onChange={(e) => setLotDescription(e.target.value)} placeholder="Opcional" />
                </div>
              </div>

              {/* Quantity */}
              <div style={{ maxWidth: 200 }}>
                <label style={lbl}>Qtd. Badges *</label>
                <input type="number" value={lotQuantity} onChange={(e) => setLotQuantity(e.target.value)} placeholder="100" required min="1" />
              </div>

              {/* Validity mode */}
              <div>
                <label style={lbl}>Validade *</label>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {(["days", "months", "range"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLotValidityMode(m)}
                      style={{
                        padding: "4px 11px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid",
                        cursor: "pointer",
                        fontWeight: lotValidityMode === m ? 600 : 400,
                        background: lotValidityMode === m ? "rgba(181,212,0,0.15)" : "transparent",
                        color: lotValidityMode === m ? "var(--primary)" : "var(--muted)",
                        borderColor: lotValidityMode === m ? "rgba(181,212,0,0.4)" : "var(--line)",
                      }}
                    >
                      {m === "days" ? "Dias" : m === "months" ? "Meses" : "Período"}
                    </button>
                  ))}
                </div>

                {lotValidityMode === "days" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min={1} value={lotDays} onChange={(e) => setLotDays(e.target.value)} style={{ maxWidth: 100 }} />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>dias</span>
                  </div>
                )}

                {lotValidityMode === "months" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min={1} value={lotMonths} onChange={(e) => setLotMonths(e.target.value)} placeholder="0" style={{ maxWidth: 100 }} />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      meses{lotMonths ? ` (≈ ${parseInt(lotMonths) * 30} dias)` : ""}
                    </span>
                  </div>
                )}

                {lotValidityMode === "range" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={lbl}>Início</label>
                      <input type="datetime-local" value={lotRangeStart} onChange={(e) => setLotRangeStart(e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Fim</label>
                      <input type="datetime-local" value={lotRangeEnd} onChange={(e) => setLotRangeEnd(e.target.value)} />
                    </div>
                    {lotRangeStart && lotRangeEnd && (
                      <span style={{ gridColumn: "1/-1", fontSize: 11, color: "var(--muted)" }}>
                        Equivale a {computeLotDays()} dias de validade
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button type="submit" style={{ fontSize: 12, padding: "6px 14px", width: "auto" }} disabled={isBusy}>Criar Lote</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => setShowCreateLot(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {org && (
        <>
          {/* ── Info card ── */}
          <section className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px 16px", marginBottom: 10 }}>
              <OrgInfoField label="ID" value={`#${org.id}`} />
              <OrgInfoField label="CNPJ" value={org.document || "—"} />
              <OrgInfoField label="Status" value={getStatusLabel(org.status)} color={getStatusColor(org.status)} />
              <OrgInfoField label="Abertura" value={formatDateBR(org.opening_date)} />
            </div>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, display: "grid", gap: 4 }}>
              <OrgInfoRow label="Endereço" value={org.address || "—"} />
              <OrgInfoRow label="CNAE" value={org.cnae || "—"} />
              <OrgInfoRow label="Natureza" value={org.regime || "—"} />
            </div>
          </section>

          {/* ── Acesso Emissor ── */}
          <section style={{ marginBottom: 10, background: "var(--card, #fff)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 20px" }}>
            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#1A3A5C", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, letterSpacing: "0.5px" }}>
                  ACESSO EMISSOR
                </span>
                {issuerUser && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                    background: issuerUser.status === "active" ? "#dcfce7" : "#fee2e2",
                    color: issuerUser.status === "active" ? "#166534" : "#991b1b",
                    border: `1px solid ${issuerUser.status === "active" ? "#86efac" : "#fca5a5"}`,
                  }}>
                    {issuerUser.status === "active" ? "● Ativo" : "● Inativo"}
                  </span>
                )}
              </div>
              {issuerUser && (
                <button onClick={resetIssuerPassword}
                  style={{ background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Redefinir para Emissor123
                </button>
              )}
            </div>

            {issuerUser ? (
              <>
                {/* Grade: LOGIN | SENHA | COPIAR */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "start" }}>

                  {/* LOGIN */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>Login (e-mail)</span>
                      {!editingIssuerEmail && (
                        <button onClick={() => { setIssuerEmailDraft(issuerUser.email); setEditingIssuerEmail(true); setEditingIssuerPassword(false); }}
                          style={{ background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          Editar
                        </button>
                      )}
                    </div>
                    {editingIssuerEmail ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          type="email"
                          value={issuerEmailDraft}
                          onChange={(e) => setIssuerEmailDraft(e.target.value)}
                          placeholder="novo@email.com.br"
                          style={{ fontSize: 13, padding: "8px 10px", borderRadius: 7, border: "1px solid #1A3A5C", outline: "none", width: "100%", boxSizing: "border-box" }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveIssuerEmail(); if (e.key === "Escape") setEditingIssuerEmail(false); }}
                        />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={saveIssuerEmail}
                            style={{ flex: 1, background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Salvar
                          </button>
                          <button onClick={() => setEditingIssuerEmail(false)}
                            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-soft)", borderRadius: 7, padding: "9px 10px", border: "1px solid var(--line)", minHeight: 38 }}>
                        <code style={{ fontSize: 13, color: "#1A3A5C", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {showIssuerLogin
                            ? (issuerUser.email ? String(issuerUser.email) : "⚠ email não carregado")
                            : "••••••••••••••••••"}
                        </code>
                        <button onClick={() => setShowIssuerLogin((v) => !v)}
                          title={showIssuerLogin ? "Ocultar login" : "Mostrar login"}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "0 2px", flexShrink: 0, opacity: 0.6 }}>
                          {showIssuerLogin ? "🙈" : "👁️"}
                        </button>
                        <button onClick={() => copyToClipboard(issuerUser.email, "email")}
                          title="Copiar login"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>
                          {copiedField === "email" ? "✅" : "📋"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SENHA */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>Senha</span>
                      {!editingIssuerPassword && (
                        <button onClick={() => { setIssuerPasswordDraft(""); setEditingIssuerPassword(true); setEditingIssuerEmail(false); }}
                          style={{ background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          Editar Senha
                        </button>
                      )}
                    </div>
                    {editingIssuerPassword ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          type="password"
                          value={issuerPasswordDraft}
                          onChange={(e) => setIssuerPasswordDraft(e.target.value)}
                          placeholder="Nova senha (mín. 6 chars)"
                          style={{ fontSize: 13, padding: "8px 10px", borderRadius: 7, border: "1px solid #1A3A5C", outline: "none", width: "100%", boxSizing: "border-box" }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveIssuerPassword(); if (e.key === "Escape") setEditingIssuerPassword(false); }}
                        />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={saveIssuerPassword}
                            style={{ flex: 1, background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Salvar
                          </button>
                          <button onClick={() => setEditingIssuerPassword(false)}
                            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : issuerUser.password_is_default !== false ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0fdf4", borderRadius: 7, padding: "9px 10px", border: "1px solid #86efac", minHeight: 38 }}>
                        <code style={{ fontSize: 14, color: "#16a34a", fontWeight: 700, flex: 1, letterSpacing: showIssuerPassword ? "1px" : "3px" }}>
                          {showIssuerPassword ? "Emissor123" : "••••••••••"}
                        </code>
                        <button onClick={() => setShowIssuerPassword((v) => !v)}
                          title={showIssuerPassword ? "Ocultar senha" : "Mostrar senha"}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "0 2px", flexShrink: 0, opacity: 0.6 }}>
                          {showIssuerPassword ? "🙈" : "👁️"}
                        </button>
                        <button onClick={() => copyToClipboard("Emissor123", "senha")}
                          title="Copiar senha"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>
                          {copiedField === "senha" ? "✅" : "📋"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fef9ec", borderRadius: 7, padding: "9px 10px", border: "1px solid #fcd34d", minHeight: 38 }}>
                        <span style={{ fontSize: 14, color: "#78350f", fontWeight: 700, flex: 1, letterSpacing: "3px" }}>••••••••</span>
                        <span style={{ fontSize: 10, color: "#92400e", fontWeight: 600, whiteSpace: "nowrap" }}>personalizada</span>
                      </div>
                    )}
                  </div>

                  {/* COPIAR TUDO */}
                  <div style={{ paddingTop: 22 }}>
                    <button
                      onClick={() => copyToClipboard(`Login: ${issuerUser.email}\nSenha: ${issuerUser.password_is_default !== false ? "Emissor123" : "(senha personalizada)"}`, "ambos")}
                      style={{ background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", height: 38 }}>
                      {copiedField === "ambos" ? "✅ Copiado!" : "📋 Copiar tudo"}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  {issuerUser.password_is_default !== false
                    ? "Senha padrão de primeiro acesso · O emissor pode alterar após o login"
                    : "Emissor definiu senha própria · Use 'Redefinir para Emissor123' se precisar recuperar o acesso"}
                </p>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Nenhum emissor vinculado a esta organização.</p>
                <button onClick={createIssuer}
                  style={{ background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  + Criar emissor padrão
                </button>
              </div>
            )}
          </section>

          {/* ── KPIs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            <OrgKpiMini label="Lotes" value={lots.length} />
            <OrgKpiMini label="Emitidos" value={totalIssued} />
            <OrgKpiMini label="Saldo" value={totalRemaining} />
          </div>

          {/* ── Espelho Operacional ── */}
          {credentials.length > 0 && (
            <section className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "#0f766e", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6 }}>
                    ESPELHO OPERACIONAL
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>últimas emissões · dados controlados por LGPD</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{credentials.length} emissão{credentials.length !== 1 ? "ões" : ""}</span>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Total emitido", value: credentials.length, color: "#1A3A5C" },
                  { label: "Válidas", value: credentials.filter((c: Cred) => c.status === "valid").length, color: "#16a34a" },
                  { label: "Retificadas", value: credentials.filter((c: Cred) => c.status === "rectified").length, color: "#d97706" },
                  { label: "Revogadas", value: credentials.filter((c: Cred) => c.status === "revoked").length, color: "#dc2626" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Table - últimas 10 */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {["Destinatário", "Certificação", "Status", "ID Público"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.slice(0, 10).map((c: Cred) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--line)", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-soft)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "8px 10px", color: "var(--text)" }}>
                          {maskName(c.recipient_name)}
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                          {c.course_name}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                            background: c.status === "valid" ? "#dcfce7" : c.status === "rectified" ? "#fef9c3" : c.status === "revoked" ? "#fee2e2" : "#f3f4f6",
                            color: c.status === "valid" ? "#166534" : c.status === "rectified" ? "#854d0e" : c.status === "revoked" ? "#991b1b" : "#6b7280",
                          }}>
                            {c.status === "valid" ? "Válida" : c.status === "rectified" ? "Retificada" : c.status === "revoked" ? "Revogada" : c.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <code style={{ fontSize: 10, color: "var(--muted)" }}>{c.public_id}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Tabs ── */}
          <section className="card">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              {(["overview", "active", "revoked", "notes", "trash"] as TabKey[]).map((t) => {
                const labels: Record<TabKey, string> = {
                  overview: "Visão Geral",
                  active: `Lotes Ativos${activeLots.length > 0 ? ` (${activeLots.length})` : ""}`,
                  revoked: "Revogados",
                  notes: `Anotações${notesList.length > 0 ? ` (${notesList.length})` : ""}`,
                  trash: `Lixeira${(trashedLots.length + trashedCreds.length) > 0 ? ` (${trashedLots.length + trashedCreds.length})` : ""}`,
                };
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      fontSize: 12,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: tab === t ? "1px solid var(--primary)" : "1px solid var(--line)",
                      background: tab === t ? "rgba(91,45,142,0.1)" : "transparent",
                      color: tab === t ? "var(--primary)" : "var(--muted)",
                      fontWeight: tab === t ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            {/* Overview */}
            {tab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                {lots.map((l) => (
                  <Link key={l.id} href={`/admin/lots/${l.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--bg-soft)",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(91,45,142,0.1)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
                          {l.title || `Lote #${l.id}`}
                        </span>
                        <span style={{
                          padding: "2px 7px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          background: `${getStatusColor(l.status)}18`,
                          color: getStatusColor(l.status),
                          border: `1px solid ${getStatusColor(l.status)}50`,
                          whiteSpace: "nowrap",
                          marginLeft: 8,
                        }}>
                          {getStatusLabel(l.status)}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                        <OrgLotStat label="Total" value={l.total_badges} />
                        <OrgLotStat label="Emitidos" value={l.issued} />
                        <OrgLotStat label="Saldo" value={l.remaining} />
                      </div>
                      {l.issue_window_days && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5 }}>
                          Janela: {l.issue_window_days} dias
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
                {!lots.length && (
                  <div style={{ gridColumn: "1/-1", padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    Nenhum lote cadastrado.{" "}
                    <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px", marginLeft: 6 }} onClick={openCreateLotForm}>
                      + Criar primeiro lote
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active lots */}
            {tab === "active" && (
              <div style={{ display: "grid", gap: 6 }}>
                {activeLots.map((l) => (
                  <div key={l.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--card)",
                  }}>
                    <Link href={`/admin/lots/${l.id}`} style={{ flex: 1, textDecoration: "none" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
                        {l.title || `Lote #${l.id}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Total {l.total_badges} · Emitidos {l.issued} · Saldo {l.remaining} · {l.issue_window_days || 0} dias
                      </div>
                    </Link>
                    <span style={{
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${getStatusColor(l.status)}18`,
                      color: getStatusColor(l.status),
                      border: `1px solid ${getStatusColor(l.status)}50`,
                      whiteSpace: "nowrap",
                    }}>
                      {getStatusLabel(l.status)}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {l.status === "active" ? (
                        <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => updateLot(l.id, { status: "paused" })}>Pausar</button>
                      ) : (
                        <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => updateLot(l.id, { status: "active" })}>Ativar</button>
                      )}
                      <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => revokeLotFlow(l)}>Revogar</button>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px", color: "#DC2626", borderColor: "#DC262640" }} onClick={() => moveLotToTrash(l)}>Lixeira</button>
                    </div>
                  </div>
                ))}
                {!activeLots.length && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: 13 }}>
                    Nenhum lote ativo.
                  </div>
                )}
              </div>
            )}

            {/* Revoked lots */}
            {tab === "revoked" && (
              <div style={{ display: "grid", gap: 6 }}>
                {revokedLots.map((l) => (
                  <div key={l.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--card)",
                  }}>
                    <Link href={`/admin/lots/${l.id}`} style={{ flex: 1, textDecoration: "none" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{l.title || `Lote #${l.id}`}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Emitidos {l.issued} · Total {l.total_badges}
                      </div>
                    </Link>
                    <span style={{
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${getStatusColor(l.status)}18`,
                      color: getStatusColor(l.status),
                      border: `1px solid ${getStatusColor(l.status)}50`,
                      whiteSpace: "nowrap",
                    }}>
                      {getStatusLabel(l.status)}
                    </span>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px", flexShrink: 0 }} onClick={() => recoverLotFlow(l)}>Recuperar</button>
                  </div>
                ))}
                {!revokedLots.length && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: 13 }}>
                    Nenhum lote revogado.
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {tab === "notes" && (
              <div style={{ display: "grid", gap: 10, maxWidth: 600 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Título (opcional)"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anotação interna..."
                    style={{
                      minHeight: 80,
                      borderRadius: 7,
                      padding: "8px 10px",
                      fontSize: 13,
                      background: "var(--bg-soft)",
                      color: "var(--text)",
                      border: "1px solid var(--line)",
                      resize: "vertical",
                      fontFamily: "inherit",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                  <button onClick={saveNote} style={{ fontSize: 12, padding: "6px 14px", width: "auto" }}>
                    Salvar anotação
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {notesList.map((n, i) => (
                    <div key={n.id} style={{
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--bg-soft)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <strong style={{ fontSize: 13, color: "var(--text)" }}>{n.title || `Anotação ${i + 1}`}</strong>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.created_at?.slice(0, 10) || ""}</span>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "2px 7px", color: "#DC2626", borderColor: "#DC262640" }}
                            onClick={() => removeNote(n.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{n.content}</p>
                    </div>
                  ))}
                  {!notesList.length && (
                    <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>
                      Nenhuma anotação salva.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trash tab */}
            {tab === "trash" && (
              <div style={{ display: "grid", gap: 12 }}>
                {org.status === "trashed" && (
                  <div style={{
                    padding: "12px 14px",
                    border: "1px solid #DC262630",
                    borderRadius: 8,
                    background: "#DC262606",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>
                        Esta organização está na lixeira
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Restaure para continuar usando, ou exclua permanentemente.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={restoreOrganization}>
                        Restaurar
                      </button>
                      <button
                        style={{ fontSize: 12, padding: "5px 10px", background: "#DC2626", color: "white", borderRadius: 7, border: "none", cursor: "pointer" }}
                        onClick={permanentDeleteOrganization}
                      >
                        Excluir permanentemente
                      </button>
                    </div>
                  </div>
                )}

                {trashedLots.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
                      Lotes na lixeira ({trashedLots.length})
                    </p>
                    <div style={{ display: "grid", gap: 5 }}>
                      {trashedLots.map((l) => (
                        <div key={l.id} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: 7,
                          background: "var(--card)",
                          gap: 10,
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                              {l.title || `Lote #${l.id}`}
                            </span>
                            <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 8 }}>
                              Total {l.total_badges} · Emitidos {l.issued}
                            </span>
                          </div>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => recoverLotFlow(l)}>
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trashedCreds.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
                      Credenciais na lixeira ({trashedCreds.length})
                    </p>
                    <div style={{ display: "grid", gap: 5 }}>
                      {trashedCreds.map((c) => (
                        <div key={c.id} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: 7,
                          background: "var(--card)",
                          gap: 10,
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.recipient_name}</span>
                            <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 8 }}>{c.course_name}</span>
                          </div>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => updateCredential(c.id, "valid")}>
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trashedLots.length === 0 && trashedCreds.length === 0 && org.status !== "trashed" && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: 13 }}>
                    Lixeira vazia.
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/* ── Helper sub-components ── */

function OrgInfoField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}

function OrgInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
      <span style={{ color: "var(--muted)", minWidth: 72, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function OrgKpiMini({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: "8px 12px",
      border: "1px solid var(--line)",
      borderRadius: 8,
      background: "var(--card)",
      textAlign: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function OrgLotStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 10 }}>{label}</div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  display: "block",
  marginBottom: 3,
};
