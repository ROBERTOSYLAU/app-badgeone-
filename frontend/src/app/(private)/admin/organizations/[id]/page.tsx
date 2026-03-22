"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../../lib/api";
import { useAuth } from "../../../../../lib/auth-context";
import { useToast } from "../../../../../lib/toast-context";
import { useConfirm } from "../../../../../lib/confirm-modal";

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
  const toast = useToast();
  const confirm = useConfirm();
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
    toast.error(msg || prefix);
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
    const ok = await confirm(`Redefinir a senha de "${issuerUser.email}" para Emissor123?`, { danger: true, confirmText: "Redefinir" });
    if (!ok) return;
    try {
      await apiPost(`/api/v1/users/${issuerUser.id}/reset-password`, {});
      setIssuerUser((prev) => prev ? { ...prev, password_is_default: true } : prev);
      toast.success("Senha redefinida para Emissor123.");
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
      toast.success("Login do emissor atualizado.");
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
      toast.success("Senha do emissor atualizada pelo admin.");
    } catch (e) {
      setApiError("Erro ao atualizar senha.", e);
    }
  }

  async function createIssuer() {
    try {
      const res = await apiPost(`/api/v1/organizations/${orgId}/ensure-issuer`, {}) as IssuerUser & { password_is_default: boolean };
      await loadAll();
      toast.success(`Emissor criado: ${res.email}`);
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
      toast.error("Erro ao carregar a organização.");
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
      toast.error("Informe um CNPJ válido com 14 dígitos.");
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

      toast.success("Dados do CNPJ carregados com sucesso.");
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
      toast.info("Migração executada com sucesso. Agora salve novamente a organização.");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao executar migração.", e);
    } finally {
      setIsBusy(false);
    }
  }

  async function deactivateOrganization() {
    if (!org) return;
    const ok = await confirm(`Tem certeza que deseja pausar a organização ${org.name}?`, { danger: true, confirmText: "Pausar" });
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/deactivate`, {});
      toast.success("Organização pausada com sucesso.");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao pausar organização.", e);
    }
  }

  async function activateOrganization() {
    if (!org) return;
    const ok = await confirm(`Tem certeza que deseja ativar a organização ${org.name}?`, { confirmText: "Ativar" });
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/activate`, {});
      toast.success("Organização ativada com sucesso.");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao ativar organização.", e);
    }
  }

  async function deleteOrganization() {
    if (!org) return;
    const ok = await confirm(`Tem certeza que deseja mover ${org.name} para a lixeira?`, { danger: true, confirmText: "Mover para lixeira" });
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}`);
      toast.success("Organização movida para lixeira.");
      await loadAll();
      setTab("trash");
    } catch (e) {
      setApiError("Erro ao mover para lixeira.", e);
    }
  }

  async function permanentDeleteOrganization() {
    if (!org) return;
    const ok = await confirm(
      `Tem certeza que deseja excluir permanentemente ${org.name}? Esta ação não poderá ser desfeita.`,
      { danger: true, confirmText: "Excluir permanentemente" }
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
    const ok = await confirm(`Tem certeza que deseja restaurar ${org.name}?`, { confirmText: "Restaurar" });
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/restore`, {});
      toast.success("Organização restaurada.");
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
      toast.success("Anotação salva.");
      setNoteTitle("");
      setNotes("");
      await loadAll();
    } catch (e) {
      setApiError("Erro ao salvar anotação.", e);
    }
  }

  async function removeNote(noteId: number) {
    const ok = await confirm("Tem certeza que deseja remover esta anotação?", { danger: true, confirmText: "Remover" });
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organization-notes/${noteId}`);
      await loadAll();
      toast.success("Anotação removida.");
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
      toast.success("Lote atualizado.");
    } catch (e) {
      setApiError("Erro ao atualizar lote.", e);
    }
  }

  async function moveLotToTrash(l: Lot) {
    const ok = await confirm(`Tem certeza que deseja mover o lote ${l.title || "#" + l.id} para a lixeira?`, { danger: true, confirmText: "Mover para lixeira" });
    if (!ok) return;
    await updateLot(l.id, { status: "trashed" });
  }

  async function revokeLotFlow(l: Lot) {
    const full = await confirm(
      `Deseja revogar totalmente o lote ${l.title || "#" + l.id}? Clique em "Total" para revogar tudo, ou Cancelar para revogar parcialmente via prompt.`,
      { danger: true, confirmText: "Revogar Total" }
    );

    if (full) {
      try {
        await apiPost(`/api/v1/lots/${l.id}/revoke`, { mode: "full" });
        await loadAll();
        toast.success("Lote revogado totalmente.");
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
      toast.success("Revogação parcial concluída.");
    } catch (e) {
      setApiError("Erro ao revogar lote parcialmente.", e);
    }
  }

  async function recoverLotFlow(l: Lot) {
    const ok = await confirm(`Tem certeza que deseja recuperar o lote ${l.title || "#" + l.id}?`, { confirmText: "Recuperar" });
    if (!ok) return;

    const qtyInput = window.prompt("Quantidade para recuperar (opcional):", "0");
    const qty = qtyInput && !Number.isNaN(Number(qtyInput)) ? Number(qtyInput) : 0;

    try {
      await apiPost(`/api/v1/lots/${l.id}/recover`, {
        quantity: qty,
        to_status: "active",
      });
      await loadAll();
      toast.success("Lote recuperado com sucesso.");
    } catch (e) {
      setApiError("Erro ao recuperar lote.", e);
    }
  }

  async function updateCredential(credentialId: number, status: string) {
    try {
      await apiPatch(`/api/v1/credentials/${credentialId}`, { status });
      await loadAll();
      toast.success("Credencial atualizada.");
    } catch (e) {
      setApiError("Erro ao atualizar credencial.", e);
    }
  }

  async function trashCredential(credentialId: number) {
    const ok = await confirm("Tem certeza que deseja mover esta credencial para a lixeira?", { danger: true, confirmText: "Mover para lixeira" });
    if (!ok) return;
    await updateCredential(credentialId, "trashed");
  }

  async function revokeCredential(credentialId: number) {
    const ok = await confirm("Tem certeza que deseja revogar esta credencial?", { danger: true, confirmText: "Revogar" });
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
      toast.success("Organização atualizada com sucesso!");
      setIsEditing(false);
      await loadAll();
    } catch (e) {
      setApiError("Erro ao atualizar organização.", e);
    }
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();

    if (!org) {
      toast.error("Organização não encontrada.");
      return;
    }

    if (org.status === "trashed") {
      toast.error("Não é possível criar lote para organização na lixeira.");
      return;
    }

    const qty = Number(lotQuantity);
    const issueWindow = computeLotDays();

    if (!qty || qty <= 0) {
      toast.error("Quantidade deve ser maior que 0.");
      return;
    }

    if (!issueWindow || issueWindow <= 0) {
      toast.error("Informe uma validade maior que zero.");
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

      toast.success("Lote criado com sucesso!");
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

          {/* ── Acesso Emissor + KPIs (2 colunas) ── */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>

            {/* Coluna esquerda: Card emissor */}
            <div style={{ width: 300, flexShrink: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "#1A3A5C", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>ACESSO EMISSOR</span>
                  {issuerUser && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999,
                      background: issuerUser.status === "active" ? "#dcfce7" : "#fee2e2",
                      color: issuerUser.status === "active" ? "#166534" : "#991b1b",
                      border: `1px solid ${issuerUser.status === "active" ? "#86efac" : "#fca5a5"}` }}>
                      {issuerUser.status === "active" ? "● Ativo" : "● Inativo"}
                    </span>
                  )}
                </div>
              </div>

              {issuerUser ? (
                <>
                  {/* LOGIN */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Login</div>
                    {editingIssuerEmail ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input type="email" value={issuerEmailDraft} onChange={(e) => setIssuerEmailDraft(e.target.value)} autoFocus
                          style={{ flex: 1, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #1A3A5C", outline: "none" }}
                          onKeyDown={(e) => { if (e.key === "Enter") saveIssuerEmail(); if (e.key === "Escape") setEditingIssuerEmail(false); }} />
                        <button type="button" onClick={saveIssuerEmail} style={{ fontSize: 11, padding: "0 8px", background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>OK</button>
                        <button type="button" onClick={() => setEditingIssuerEmail(false)} style={{ fontSize: 11, padding: "0 7px", background: "none", border: "1px solid #e2e8f0", borderRadius: 5, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f8fafc", borderRadius: 6, padding: "6px 10px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: 12, color: "#1A3A5C", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                          {issuerUser?.email || "sem email"}
                        </span>
                        <button type="button" onClick={() => copyToClipboard(issuerUser.email, "email")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>{copiedField === "email" ? "✅" : "📋"}</button>
                      </div>
                    )}
                  </div>

                  {/* SENHA */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Senha</div>
                    {editingIssuerPassword ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input type="password" value={issuerPasswordDraft} onChange={(e) => setIssuerPasswordDraft(e.target.value)} autoFocus placeholder="mín. 6 chars"
                          style={{ flex: 1, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #1A3A5C", outline: "none" }}
                          onKeyDown={(e) => { if (e.key === "Enter") saveIssuerPassword(); if (e.key === "Escape") setEditingIssuerPassword(false); }} />
                        <button type="button" onClick={saveIssuerPassword} style={{ fontSize: 11, padding: "0 8px", background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>OK</button>
                        <button type="button" onClick={() => setEditingIssuerPassword(false)} style={{ fontSize: 11, padding: "0 7px", background: "none", border: "1px solid #e2e8f0", borderRadius: 5, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: issuerUser.password_is_default !== false ? "#f0fdf4" : "#fef9ec", borderRadius: 6, padding: "6px 10px", border: `1px solid ${issuerUser.password_is_default !== false ? "#86efac" : "#fcd34d"}` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, fontFamily: "monospace", color: issuerUser.password_is_default !== false ? "#16a34a" : "#92400e", letterSpacing: showIssuerPassword ? "0.5px" : "3px" }}>
                          {issuerUser.password_is_default !== false ? (showIssuerPassword ? "Emissor123" : "••••••••••") : "••••••••"}
                        </span>
                        {issuerUser.password_is_default !== false && (
                          <button type="button" onClick={() => setShowIssuerPassword(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>{showIssuerPassword ? "🙈" : "👁️"}</button>
                        )}
                        {issuerUser.password_is_default !== false && (
                          <button type="button" onClick={() => copyToClipboard("Emissor123", "senha")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>{copiedField === "senha" ? "✅" : "📋"}</button>
                        )}
                        {issuerUser.password_is_default === false && (
                          <span style={{ fontSize: 10, color: "#92400e", fontWeight: 600 }}>personalizada</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botões de ação */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    {!editingIssuerEmail && !editingIssuerPassword && (
                      <>
                        <button type="button" onClick={() => { setIssuerEmailDraft(issuerUser.email); setEditingIssuerEmail(true); setEditingIssuerPassword(false); }}
                          style={{ fontSize: 11, padding: "4px 10px", background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", borderRadius: 5, cursor: "pointer", fontWeight: 500 }}>
                          ✏️ Editar Login
                        </button>
                        <button type="button" onClick={() => { setIssuerPasswordDraft(""); setEditingIssuerPassword(true); setEditingIssuerEmail(false); }}
                          style={{ fontSize: 11, padding: "4px 10px", background: "#eff6ff", border: "1px solid #93c5fd", color: "#1d4ed8", borderRadius: 5, cursor: "pointer", fontWeight: 500 }}>
                          🔑 Editar Senha
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button type="button"
                      onClick={() => copyToClipboard(`Login: ${issuerUser.email}\nSenha: ${issuerUser.password_is_default !== false ? "Emissor123" : "(personalizada)"}\nAcesse: https://app.badgeone.com.br/login`, "ambos")}
                      style={{ flex: 1, fontSize: 11, padding: "5px 8px", background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {copiedField === "ambos" ? "✅ Copiado!" : "📋 Copiar credenciais"}
                    </button>
                    <button type="button" onClick={resetIssuerPassword}
                      style={{ fontSize: 11, padding: "5px 8px", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 6, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>
                      Redefinir senha
                    </button>
                  </div>

                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, lineHeight: 1.4 }}>
                    {issuerUser.password_is_default !== false ? "Senha padrão · emissor pode alterar no primeiro acesso" : "Emissor definiu senha própria"}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Nenhum emissor vinculado.</div>
                  <button type="button" onClick={createIssuer}
                    style={{ fontSize: 12, padding: "6px 14px", background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    + Criar emissor padrão
                  </button>
                </div>
              )}
            </div>

            {/* Coluna direita: KPIs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {[
                { label: "Lotes", value: lots.length, color: "#1A3A5C", bg: "#eff6ff", border: "#bfdbfe" },
                { label: "Emitidos", value: totalIssued, color: "#1A3A5C", bg: "#f0fdf4", border: "#bbf7d0" },
                { label: "Saldo", value: totalRemaining, color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{k.label}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</span>
                </div>
              ))}
            </div>
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
          <section className="card" style={{ padding: "0" }}>
            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)" }}>
              {(["overview", "active", "revoked", "notes", "trash"] as TabKey[]).map((t) => {
                const labels: Record<TabKey, string> = {
                  overview: `Todos (${lots.length})`,
                  active: `Ativos (${activeLots.length})`,
                  revoked: `Revogados (${revokedLots.length})`,
                  notes: `Anotações (${notesList.length})`,
                  trash: `Lixeira (${trashedLots.length + trashedCreds.length})`,
                };
                return (
                  <button key={t} onClick={() => setTab(t)} style={{
                    fontSize: 11, padding: "7px 13px", border: "none", borderBottom: tab === t ? "2px solid #1A3A5C" : "2px solid transparent",
                    background: "transparent", color: tab === t ? "#1A3A5C" : "#64748b", fontWeight: tab === t ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "10px 12px" }}>

            {/* helper: tabela de lotes */}
            {(tab === "overview" || tab === "active" || tab === "revoked") && (() => {
              const rows = tab === "overview" ? lots : tab === "active" ? activeLots : revokedLots;
              const empty = tab === "overview" ? "Nenhum lote cadastrado." : tab === "active" ? "Nenhum lote ativo." : "Nenhum lote revogado.";
              if (!rows.length) return (
                <div style={{ textAlign: "center", color: "var(--muted)", padding: "16px 0", fontSize: 13 }}>
                  {empty}{tab === "overview" && <button className="btn-ghost" style={{ fontSize: 12, padding: "3px 9px", marginLeft: 8 }} onClick={openCreateLotForm}>+ Criar lote</button>}
                </div>
              );
              return (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--line)" }}>
                      {["Nome", "Total", "Emitidos", "Saldo", "Janela", "Validade", "Status", ""].map(h => (
                        <th key={h} style={{ textAlign: h === "Total" || h === "Emitidos" || h === "Saldo" ? "right" : "left", padding: "4px 8px", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l.id} style={{ borderBottom: "1px solid var(--line)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "5px 8px", maxWidth: 200 }}>
                          <Link href={`/admin/lots/${l.id}`} style={{ textDecoration: "none", color: "#1A3A5C", fontWeight: 600, fontSize: 12 }}>{l.title || `Lote #${l.id}`}</Link>
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: "#374151" }}>{l.total_badges}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: "#374151" }}>{l.issued}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: (l.remaining ?? 0) > 0 ? "#16a34a" : "#dc2626" }}>{l.remaining ?? 0}</span>
                          {l.total_badges > 0 && (
                            <div className="lot-progress-wrap" style={{ width: 50, marginLeft: "auto" }}>
                              <div className="lot-progress-fill" style={{ width: `${Math.round(((l.remaining ?? 0) / l.total_badges) * 100)}%`, background: (l.remaining ?? 0) / l.total_badges > 0.3 ? "#16a34a" : "#f59e0b" }} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "5px 8px", color: "#64748b", whiteSpace: "nowrap" }}>{l.issue_window_days ? `${l.issue_window_days}d` : "—"}</td>
                        <td style={{ padding: "5px 8px", color: "#64748b", whiteSpace: "nowrap", fontSize: 11 }}>
                          {l.start_date || l.end_date ? `${l.start_date ? formatDateBR(l.start_date) : "?"} → ${l.end_date ? formatDateBR(l.end_date) : "∞"}` : "—"}
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: `${getStatusColor(l.status)}18`, color: getStatusColor(l.status), border: `1px solid ${getStatusColor(l.status)}50`, whiteSpace: "nowrap" }}>
                            {getStatusLabel(l.status)}
                          </span>
                        </td>
                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 3 }}>
                            {tab !== "revoked" && (l.status === "active"
                              ? <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => updateLot(l.id, { status: "paused" })}>Pausar</button>
                              : l.status === "paused" ? <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => updateLot(l.id, { status: "active" })}>Ativar</button> : null
                            )}
                            {tab !== "revoked" && <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => revokeLotFlow(l)}>Revogar</button>}
                            {tab === "revoked" && <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => recoverLotFlow(l)}>Recuperar</button>}
                            {tab !== "revoked" && <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px", color: "#DC2626", borderColor: "#DC262640" }} onClick={() => moveLotToTrash(l)}>Lixeira</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}

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
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "16px 0", fontSize: 13 }}>
                    Lixeira vazia.
                  </div>
                )}
              </div>
            )}

            </div>{/* /padding wrapper */}
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
