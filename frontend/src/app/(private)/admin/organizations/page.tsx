"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiDelete } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Org = { id: number; name: string; document?: string; status: string };

type CnpjData = {
  nome: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  cnae_fiscal_descricao: string;
  data_inicio_atividade: string;
  natureza_juridica: string;
};

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [address, setAddress] = useState("");
  const [cnae, setCnae] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [regime, setRegime] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }
    loadOrgs();
  }, [user, isLoading, router]);

  async function loadOrgs() {
    apiGet("/api/v1/organizations").then(setOrgs).catch(() => {});
  }

  async function toggleOrgStatus(id: number, currentStatus: string) {
    try {
      if (currentStatus === "active") {
        await apiPost(`/api/v1/organizations/${id}/deactivate`, {});
      } else {
        await apiPost(`/api/v1/organizations/${id}/activate`, {});
      }
      loadOrgs();
    } catch {
      setMessage("Erro ao alterar status.");
    }
  }

  async function deleteOrg(id: number) {
    if (!confirm("Tem certeza que deseja remover esta organização?")) return;
    try {
      await apiDelete(`/api/v1/organizations/${id}`);
      loadOrgs();
    } catch {
      setMessage("Erro ao remover organização.");
    }
  }

  async function lookupCnpj() {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      setMessage("CNPJ deve ter 14 dígitos");
      return;
    }
    setLoadingCnpj(true);
    setMessage("");
    try {
      const data = await apiGet(`/api/v1/organizations/cnpj/${cleanCnpj}`);
      setName(data.razao_social || data.nome_fantasia || "");
      setDocument(cleanCnpj);
      setAddress(`${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}, ${data.cep}`);
      setCnae(data.cnae_fiscal_descricao || "");
      // Formata data para BR: 2022-09-27 -> 27/09/2022
      const rawDate = data.data_inicio_atividade || "";
      if (rawDate) {
        const [year, month, day] = rawDate.split("-");
        setOpeningDate(`${day}/${month}/${year}`);
      } else {
        setOpeningDate("");
      }
      setRegime(data.natureza_juridica || "");
    } catch {
      setMessage("Erro ao buscar CNPJ. Verifique se é válido.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const payload = {
        name,
        document: document || cnpj.replace(/\D/g, ""),
        address,
        cnae,
        opening_date: openingDate,
        regime,
      };
      console.log("Enviando payload:", payload);
      await apiPost("/api/v1/organizations", payload);
      setMessage("Organização criada com sucesso!");
      setShowForm(false);
      loadOrgs();
      // Reset form
      setCnpj("");
      setName("");
      setDocument("");
      setAddress("");
      setCnae("");
      setOpeningDate("");
      setRegime("");
    } catch (err: any) {
      console.error("Erro ao criar organização:", err);
      const errorMsg = err?.message || "Erro ao criar organização.";
      setMessage(errorMsg);
    }
  }

  const filtered = useMemo(() => status === "all" ? orgs : orgs.filter((o) => o.status === status), [orgs, status]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organizações ({status})</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "+ Nova Organização"}
          </button>
          <button className="btn-ghost" onClick={() => router.back()}>← Voltar</button>
        </div>
      </div>

      {showForm && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>Nova Organização</h2>
          
          {/* Busca CNPJ */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              placeholder="Digite o CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupCnpj(); } }}
              maxLength={18}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={lookupCnpj} disabled={loadingCnpj} style={{ width: "auto" }}>
              {loadingCnpj ? "Buscando..." : "🔍 Buscar CNPJ"}
            </button>
          </div>

          {message && <p style={{ color: message.includes("sucesso") ? "var(--success)" : "var(--danger)" }}>{message}</p>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label>Razão Social</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label>CNPJ</label>
                <input value={document} onChange={(e) => setDocument(e.target.value)} required />
              </div>
              <div>
                <label>Endereço</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>CNAE Principal</label>
                  <input value={cnae} onChange={(e) => setCnae(e.target.value)} />
                </div>
                <div>
                  <label>Data de Abertura</label>
                  <input value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label>Natureza Jurídica</label>
                <input value={regime} onChange={(e) => setRegime(e.target.value)} />
              </div>
            </div>
            <button type="submit" style={{ marginTop: 16 }}>Criar Organização</button>
          </form>
        </section>
      )}

      <section className="card">
        <ul className="list" style={{ listStyle: "none", padding: 0 }}>
          {filtered.map((o, i) => (
            <li key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <Link href={`/admin/organizations/${o.id}`} style={{ fontWeight: 600 }}>{i + 1}. {o.name}</Link>
                <span className="muted" style={{ marginLeft: 8 }}>({o.status})</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-ghost" style={{ width: "auto", fontSize: 12 }} onClick={() => toggleOrgStatus(o.id, o.status)}>
                  {o.status === "active" ? "⏸️ Pausar" : "▶️ Ativar"}
                </button>
                <button type="button" className="btn-ghost" style={{ width: "auto", fontSize: 12, color: "var(--danger)" }} onClick={() => deleteOrg(o.id)}>
                  🗑️ Remover
                </button>
              </div>
            </li>
          ))}
          {!filtered.length && <li>Nenhuma organização.</li>}
        </ul>
      </section>
    </main>
  );
}
