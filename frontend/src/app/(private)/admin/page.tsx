"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../lib/api";
import { getRole, logout } from "../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };
type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
type CnpjData = {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cep?: string;
  natureza_juridica?: string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo: number; descricao: string }[];
  suggested_name?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgDoc, setOrgDoc] = useState("");
  const [lotOrgId, setLotOrgId] = useState("");
  const [lotTitle, setLotTitle] = useState("");
  const [lotDescription, setLotDescription] = useState("");
  const [lotTotal, setLotTotal] = useState("0");
  const [message, setMessage] = useState("");
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [orgFilter, setOrgFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lotFilterMode, setLotFilterMode] = useState<"all" | "active" | "revoked">("all");

  async function loadData() {
    const [o, l] = await Promise.all([apiGet("/api/v1/organizations"), apiGet("/api/v1/lots")]);
    setOrgs(o);
    setLots(l);
  }

  useEffect(() => {
    if (getRole() !== "admin") {
      router.push("/login");
      return;
    }
    loadData().catch(() => router.push("/login"));
  }, [router]);

  async function fetchCnpj() {
    setMessage("");
    const digits = orgDoc.replace(/\D/g, "");
    if (digits.length !== 14) {
      setMessage("Informe um CNPJ com 14 dígitos.");
      return;
    }

    setCnpjLoading(true);
    try {
      const data = await apiGet(`/api/v1/organizations/cnpj/${digits}`);
      setCnpjData(data);
      if (!orgName && data?.suggested_name) setOrgName(data.suggested_name);
      setMessage("CNPJ consultado com sucesso.");
    } catch {
      setCnpjData(null);
      setMessage("Não foi possível consultar esse CNPJ agora.");
    } finally {
      setCnpjLoading(false);
    }
  }

  function formatDateBr(iso?: string) {
    if (!iso) return "-";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await apiPost("/api/v1/organizations", { name: orgName || null, document: orgDoc || null });
      setOrgName("");
      setOrgDoc("");
      setCnpjData(null);
      setMessage("Organização criada com sucesso.");
      await loadData();
    } catch {
      setMessage("Erro ao criar organização.");
    }
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!lotOrgId) return setMessage("Selecione a organização.");

    try {
      await apiPost("/api/v1/lots", {
        organization_id: Number(lotOrgId),
        title: lotTitle || null,
        description: lotDescription || null,
        total_badges: Number(lotTotal || 0),
        issue_window_days: 365,
      });
      setLotOrgId("");
      setLotTitle("");
      setLotDescription("");
      setLotTotal("0");
      setMessage("Lote criado com sucesso.");
      await loadData();
    } catch {
      setMessage("Erro ao criar lote.");
    }
  }

  const filteredOrgs = orgs.filter((o) => {
    const hit = `${o.name} ${o.document || ""}`.toLowerCase().includes(orgFilter.toLowerCase());
    const okStatus = statusFilter === "all" ? true : o.status === statusFilter;
    return hit && okStatus;
  });

  const kpiActiveOrgs = orgs.filter((o) => o.status === "active").length;
  const kpiActiveLots = lots.filter((l) => l.status === "active").length;
  const kpiIssued = lots.reduce((a, b) => a + b.issued, 0);
  const kpiRevokedLots = lots.filter((l) => l.status === "revoked").length;

  const filteredLots = useMemo(() => {
    if (lotFilterMode === "active") return lots.filter((l) => l.status === "active");
    if (lotFilterMode === "revoked") return lots.filter((l) => l.status === "revoked" || l.status === "finished");
    return lots;
  }, [lots, lotFilterMode]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Admin Dashboard</h1>
        <button className="btn-ghost" onClick={() => { logout(); router.push('/'); }}>Sair</button>
      </div>

      {message && <p className={message.includes("Erro") || message.includes("Não foi") ? "error" : "success"}>{message}</p>}

      <section className="card">
        <h2>Visão rápida</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <button className="btn-ghost" style={{ textAlign: "left" }} onClick={() => router.push('/admin/organizations?status=active')}>
            <strong>{kpiActiveOrgs}</strong><p>Organizações ativas</p>
          </button>
          <button className="btn-ghost" style={{ textAlign: "left" }} onClick={() => router.push('/admin/lots?status=active')}>
            <strong>{kpiActiveLots}</strong><p>Lotes ativos</p>
          </button>
          <button className="btn-ghost" style={{ textAlign: "left" }} onClick={() => router.push('/admin/emissions')}>
            <strong>{kpiIssued}</strong><p>Badges emitidos</p>
          </button>
          <button className="btn-ghost" style={{ textAlign: "left" }} onClick={() => router.push('/admin/lots?status=revoked')}>
            <strong>{kpiRevokedLots}</strong><p>Lotes revogados</p>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Criar Organização</h2>
        <form onSubmit={createOrg} className="form-grid" style={{ maxWidth: 640 }}>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nome da organização (opcional se CNPJ preenchido)" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input value={orgDoc} onChange={(e) => setOrgDoc(e.target.value)} placeholder="CNPJ (opcional)" />
            <button type="button" className="btn-ghost" onClick={fetchCnpj} disabled={cnpjLoading}>
              {cnpjLoading ? "Buscando..." : "Buscar CNPJ"}
            </button>
          </div>

          {cnpjData && (
            <div className="card" style={{ marginBottom: 0 }}>
              <p><strong>Razão social:</strong> {cnpjData.razao_social || "-"}</p>
              <p><strong>Nome fantasia:</strong> {cnpjData.nome_fantasia || "-"}</p>
              <p><strong>Situação:</strong> {cnpjData.descricao_situacao_cadastral || "-"}</p>
              <p><strong>Abertura:</strong> {formatDateBr(cnpjData.data_inicio_atividade)}</p>
              <p><strong>Cidade/UF:</strong> {cnpjData.municipio || "-"}/{cnpjData.uf || "-"}</p>
              <p><strong>Endereço:</strong> {cnpjData.logradouro || "-"}, {cnpjData.numero || "s/n"} - {cnpjData.bairro || "-"} {cnpjData.complemento ? `(${cnpjData.complemento})` : ""}</p>
              <p><strong>CEP:</strong> {cnpjData.cep || "-"}</p>
              <p><strong>Natureza jurídica:</strong> {cnpjData.natureza_juridica || "-"}</p>
              <p><strong>CNAE principal:</strong> {cnpjData.cnae_fiscal_descricao || "-"}</p>
              <p><strong>CNAEs secundários:</strong> {cnpjData.cnaes_secundarios?.slice(0, 3).map((x) => x.descricao).join(" | ") || "-"}</p>
            </div>
          )}

          <button type="submit">Salvar organização</button>
        </form>
      </section>

      <section className="card">
        <h2>Criar Lote de Badges</h2>
        <form onSubmit={createLot} className="form-grid" style={{ maxWidth: 460 }}>
          <select value={lotOrgId} onChange={(e) => setLotOrgId(e.target.value)} required>
            <option value="">Selecione a organização</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <input value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Nome do lote (ex.: Arquitetura 2026)" />
          <input value={lotDescription} onChange={(e) => setLotDescription(e.target.value)} placeholder="Descrição do lote (opcional)" />
          <input value={lotTotal} onChange={(e) => setLotTotal(e.target.value)} type="number" min={0} placeholder="0" required />
          <button type="submit">Criar lote</button>
        </form>
      </section>

      <section className="card">
        <h2>Organizações</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 8, marginBottom: 10 }}>
          <input value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} placeholder="Buscar por nome ou CNPJ" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos status</option>
            <option value="active">Ativa</option>
            <option value="inactive">Pausada</option>
            <option value="trashed">Lixeira</option>
          </select>
        </div>
        <ul className="list">
          {filteredOrgs.map((o, i) => (
            <li key={o.id}>
              <Link href={`/admin/organizations/${o.id}`}>{i + 1}. {o.name}</Link> <span className="muted">({o.status})</span>
            </li>
          ))}
          {!filteredOrgs.length && <li>Nenhuma organização encontrada.</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Lotes</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button className="btn-ghost" onClick={() => setLotFilterMode("all")}>Todos</button>
          <button className="btn-ghost" onClick={() => setLotFilterMode("active")}>Ativos</button>
          <button className="btn-ghost" onClick={() => setLotFilterMode("revoked")}>Revogados</button>
        </div>
        <ul className="list">
          {filteredLots.map((l, i) => {
            const org = orgs.find((o) => o.id === l.organization_id);
            return (
              <li key={l.id}>
                {i + 1}. {l.title ? `${l.title} | ` : ""}Lote #{l.id} | Empresa {org?.name || `#${l.organization_id}`} | Status {l.status} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}
              </li>
            );
          })}
          {!filteredLots.length && <li>Nenhum lote para esse filtro.</li>}
        </ul>
      </section>
    </main>
  );
}
