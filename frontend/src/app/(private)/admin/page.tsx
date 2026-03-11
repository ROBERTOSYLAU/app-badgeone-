"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../lib/api";
import { getRole, logout } from "../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };
type Lot = { id: number; organization_id: number; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
type CnpjData = {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  municipio?: string;
  uf?: string;
  cnae_fiscal_descricao?: string;
  suggested_name?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgDoc, setOrgDoc] = useState("");
  const [lotOrgId, setLotOrgId] = useState("");
  const [lotTotal, setLotTotal] = useState("0");
  const [message, setMessage] = useState("");
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

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

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!orgName.trim()) return setMessage("Informe o nome da organização.");

    try {
      await apiPost("/api/v1/organizations", { name: orgName, document: orgDoc || null });
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
        total_badges: Number(lotTotal || 0),
        issue_window_days: 365,
      });
      setLotOrgId("");
      setLotTotal("0");
      setMessage("Lote criado com sucesso.");
      await loadData();
    } catch {
      setMessage("Erro ao criar lote.");
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Admin Dashboard</h1>
        <button className="btn-ghost" onClick={() => { logout(); router.push('/login'); }}>Sair</button>
      </div>

      {message && <p className={message.includes("Erro") || message.includes("Não foi") ? "error" : "success"}>{message}</p>}

      <section className="card">
        <h2>Criar Organização</h2>
        <form onSubmit={createOrg} className="form-grid" style={{ maxWidth: 640 }}>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nome da organização" required />

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
              <p><strong>Abertura:</strong> {cnpjData.data_inicio_atividade || "-"}</p>
              <p><strong>Cidade/UF:</strong> {cnpjData.municipio || "-"}/{cnpjData.uf || "-"}</p>
              <p><strong>CNAE:</strong> {cnpjData.cnae_fiscal_descricao || "-"}</p>
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
          <input value={lotTotal} onChange={(e) => setLotTotal(e.target.value)} type="number" min={0} placeholder="0" required />
          <button type="submit">Criar lote</button>
        </form>
      </section>

      <section className="card">
        <h2>Organizações</h2>
        <ul className="list">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/organizations/${o.id}`}>#{o.id} {o.name}</Link> <span className="muted">({o.status})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Lotes</h2>
        <ul className="list">
          {lots.map((l) => (
            <li key={l.id}>
              Lote #{l.id} | Org {l.organization_id} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
