"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Org = {
  id: number;
  name: string;
  document?: string;
  status: string;
  address?: string;
  cnae?: string;
  opening_date?: string;
  regime?: string;
};

type CnpjData = {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  cnae_fiscal?: string;
  cnae_fiscal_descricao?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    all: "Todos",
    active: "Ativas",
    inactive: "Inativas",
    paused: "Pausadas",
    revoked: "Revogadas",
    finished: "Finalizadas",
    trashed: "Lixeira",
  };
  return map[status] || status;
}

function orgStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativa",
    inactive: "Inativa",
    paused: "Pausada",
    revoked: "Revogada",
    finished: "Finalizada",
    trashed: "Lixeira",
  };
  return map[status] || status;
}

function formatDateBR(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

function joinAddress(data: CnpjData) {
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

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);

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
    try {
      const data = await apiGet("/api/v1/organizations");
      setOrgs((data as Org[]) || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar organizações.";
      setMessage(msg);
      setOrgs([]);
    }
  }

  async function toggleOrgStatus(id: number, currentStatus: string) {
    const acao = currentStatus === "active" ? "pausar" : "ativar";
    const ok = window.confirm(`Tem certeza que deseja ${acao} esta organização?`);
    if (!ok) return;

    try {
      if (currentStatus === "active") {
        await apiPost(`/api/v1/organizations/${id}/deactivate`, {});
      } else {
        await apiPost(`/api/v1/organizations/${id}/activate`, {});
      }
      setMessage("Status da organização atualizado com sucesso.");
      await loadOrgs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao alterar status.";
      setMessage(msg);
    }
  }

  async function moveOrgToTrash(id: number) {
    const ok = window.confirm("Tem certeza que deseja mover esta organização para a lixeira?");
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${id}`);
      setMessage("Organização movida para a lixeira.");
      await loadOrgs();
      setStatus("trashed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao mover organização para lixeira.";
      setMessage(msg);
    }
  }

  async function restoreOrg(id: number) {
    const ok = window.confirm("Tem certeza que deseja restaurar esta organização?");
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${id}/restore`, {});
      setMessage("Organização restaurada com sucesso.");
      await loadOrgs();
      setStatus("all");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao restaurar organização.";
      setMessage(msg);
    }
  }

  async function permanentlyDeleteOrg(id: number, name: string) {
    const ok = window.confirm(
      `Tem certeza que deseja excluir permanentemente a organização "${name}"? Esta ação não poderá ser desfeita.`
    );
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${id}?force=true`);
      setMessage("Organização excluída permanentemente.");
      await loadOrgs();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Erro ao remover organização permanentemente.";
      setMessage(msg);
    }
  }

  async function lookupCnpj() {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      setMessage("CNPJ deve ter 14 dígitos.");
      return;
    }

    setLoadingCnpj(true);
    setMessage("");

    try {
      const data = (await apiGet(`/api/v1/organizations/cnpj/${cleanCnpj}`)) as CnpjData;

      setName(data.razao_social || data.nome_fantasia || "");
      setDocument(cleanCnpj);
      setAddress(joinAddress(data));
      setCnae(
        [data.cnae_fiscal, data.cnae_fiscal_descricao].filter(Boolean).join(" - ")
      );

      if (data.data_inicio_atividade) {
        setOpeningDate(formatDateBR(data.data_inicio_atividade));
      } else {
        setOpeningDate("");
      }

      setRegime(data.natureza_juridica || "");
      setMessage("Dados do CNPJ carregados com sucesso.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar CNPJ.";
      setMessage(msg);
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

      await apiPost("/api/v1/organizations", payload);
      setMessage("Organização criada com sucesso!");
      setShowForm(false);
      await loadOrgs();

      setCnpj("");
      setName("");
      setDocument("");
      setAddress("");
      setCnae("");
      setOpeningDate("");
      setRegime("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar organização.";
      setMessage(msg);
    }
  }

  const filtered = useMemo(
    () => (status === "all" ? orgs : orgs.filter((o) => o.status === status)),
    [orgs, status]
  );

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organizações ({statusLabel(status)})</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Nova Organização"}
          </button>

          <button className="btn-ghost" onClick={() => loadOrgs()}>
            Atualizar
          </button>

          <button className="btn-ghost" onClick={() => router.back()}>
            ← Voltar
          </button>
        </div>
      </div>

      {message && (
        <p className={message.toLowerCase().includes("erro") ? "error" : "success"}>
          {message}
        </p>
      )}

      {showForm && (
        <section className="card">
          <h2>Nova Organização</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Buscar por CNPJ</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      lookupCnpj();
                    }
                  }}
                  maxLength={18}
                  placeholder="Digite o CNPJ"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn-ghost" onClick={lookupCnpj}>
                  {loadingCnpj ? "Buscando..." : "Buscar CNPJ"}
                </button>
              </div>
            </div>

            <div>
              <label>Razão Social</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <label>CNPJ</label>
              <input
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Endereço</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div>
              <label>CNAE Principal</label>
              <input value={cnae} onChange={(e) => setCnae(e.target.value)} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label>Data de Abertura</label>
                <input
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  placeholder="DD/MM/AAAA"
                />
              </div>

              <div>
                <label>Natureza Jurídica</label>
                <input value={regime} onChange={(e) => setRegime(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit">Criar Organização</button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className={status === "all" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("all")}>
            Todas
          </button>
          <button className={status === "active" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("active")}>
            Ativas
          </button>
          <button className={status === "inactive" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("inactive")}>
            Inativas
          </button>
          <button className={status === "trashed" ? "btn-active" : "btn-ghost"} onClick={() => setStatus("trashed")}>
            Lixeira
          </button>
        </div>

        <ul className="list">
          {filtered.map((o, i) => (
            <li key={o.id}>
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <strong>
                    {i + 1}. {o.name}
                  </strong>{" "}
                  <span className="muted">({orgStatusLabel(o.status)})</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn-ghost" href={`/admin/organizations/${o.id}`}>
                    Ver Detalhes
                  </Link>

                  {o.status === "trashed" ? (
                    <>
                      <button className="btn-ghost" onClick={() => restoreOrg(o.id)}>
                        Restaurar
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => permanentlyDeleteOrg(o.id, o.name)}
                      >
                        Excluir Permanentemente
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-ghost"
                        onClick={() => toggleOrgStatus(o.id, o.status)}
                      >
                        {o.status === "active" ? "Pausar" : "Ativar"}
                      </button>

                      <button className="btn-ghost" onClick={() => moveOrgToTrash(o.id)}>
                        Lixeira
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}

          {!filtered.length && <li>Nenhuma organização encontrada.</li>}
        </ul>
      </section>
    </main>
  );
}
