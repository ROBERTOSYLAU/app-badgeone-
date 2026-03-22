"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { logAction } from "../../../../lib/history";

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
  logradouro_sem_prefixo?: string;
  descricao_tipo_de_logradouro?: string;
  descricao_tipo_logradouro?: string;
  tipo_logradouro?: string;
  logradouro_tipo?: string;
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

function orgStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativa",
    inactive: "Inativa",
    paused: "Pausada",
    revoked: "Revogada",
    finished: "Finalizada",
    trashed: "Na lixeira",
  };
  return map[status] || status;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: "#22c55e",
    inactive: "#f59e0b",
    paused: "#f59e0b",
    revoked: "#ef4444",
    finished: "#6b7280",
    trashed: "#9ca3af",
  };
  return map[status] || "#9ca3af";
}

function formatDateBR(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

function normalizeDateToApi(value?: string) {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }

  return v;
}

function formatCep(cep?: string) {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length !== 8) return cep || "";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}

function formatTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function joinAddress(data: CnpjData) {
  const rawStreet =
    (data.logradouro || "").trim() ||
    (data.logradouro_sem_prefixo || "").trim();

  const streetType =
    (data.descricao_tipo_de_logradouro || "").trim() ||
    (data.descricao_tipo_logradouro || "").trim() ||
    (data.tipo_logradouro || "").trim() ||
    (data.logradouro_tipo || "").trim();

  const knownPrefixes = [
    "R ",
    "RUA ",
    "AV ",
    "AV. ",
    "AVENIDA ",
    "AL ",
    "AL. ",
    "ALAMEDA ",
    "TR ",
    "TRAVESSA ",
    "TV ",
    "TV. ",
    "ROD ",
    "ROD. ",
    "RODOVIA ",
    "EST ",
    "EST. ",
    "ESTRADA ",
    "PC ",
    "PC. ",
    "PRAÇA ",
    "PRACA ",
    "VL ",
    "VILA ",
    "LOT ",
    "LOTEAMENTO ",
  ];

  let street = rawStreet;

  if (street) {
    const upperStreet = street.toUpperCase();

    if (!knownPrefixes.some((prefix) => upperStreet.startsWith(prefix))) {
      const normalizedType = streetType.toUpperCase().replace(/\.$/, "");

      const typeMap: Record<string, string> = {
        RUA: "R",
        R: "R",
        AVENIDA: "AV",
        AV: "AV",
        ALAMEDA: "AL",
        AL: "AL",
        TRAVESSA: "TR",
        TR: "TR",
        TV: "TV",
        RODOVIA: "ROD",
        ROD: "ROD",
        ESTRADA: "EST",
        EST: "EST",
        PRAÇA: "PC",
        PRACA: "PC",
        PC: "PC",
        VILA: "VL",
        VL: "VL",
        LOTEAMENTO: "LOT",
        LOT: "LOT",
      };

      if (normalizedType && typeMap[normalizedType]) {
        street = `${typeMap[normalizedType]} ${street}`;
      }
    }
  }

  const line1 = [formatTitleCase(street), data.numero]
    .filter(Boolean)
    .join(", ");

  const line2 = [formatTitleCase(data.bairro), formatTitleCase(data.complemento)]
    .filter(Boolean)
    .join(", ");

  const line3Base = [formatTitleCase(data.municipio), (data.uf || "").toUpperCase()]
    .filter(Boolean)
    .join(" - ");

  const cep = formatCep(data.cep);
  const line3 = cep ? `${line3Base}${line3Base ? " | " : ""}CEP: ${cep}` : line3Base;

  return [line1, line2, line3].filter(Boolean).join(" • ");
}

function shortText(value?: string, max = 90) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [address, setAddress] = useState("");
  const [cnae, setCnae] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [regime, setRegime] = useState("");

  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
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
    setLoadingPage(true);
    setMessage("");

    try {
      const data = await apiGet("/api/v1/organizations");
      setOrgs((data as Org[]) || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar organizações.";
      setMessage(msg);
      setOrgs([]);
    } finally {
      setLoadingPage(false);
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
      logAction("Org enviada para lixeira", `ID ${id}`);
      setMessage("Organização movida para a lixeira.");
      await loadOrgs();
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
      logAction("Org restaurada", `ID ${id}`);
      setMessage("Organização restaurada com sucesso.");
      await loadOrgs();
      setStatus("all");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao restaurar organização.";
      setMessage(msg);
    }
  }

  async function permanentlyDeleteOrg(id: number, orgName: string) {
    const ok = window.confirm(
      `Tem certeza que deseja excluir permanentemente a organização "${orgName}"? Esta ação não poderá ser desfeita.`
    );
    if (!ok) return;

    try {
      await apiDelete(`/api/v1/organizations/${id}?force=true`);
      logAction("Org excluída permanentemente", `ID ${id} · ${orgName}`);
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
      setCnae([data.cnae_fiscal, data.cnae_fiscal_descricao].filter(Boolean).join(" - "));

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
        name: name.trim(),
        document: (document || cnpj.replace(/\D/g, "")).trim(),
        address: address.trim(),
        cnae: cnae.trim(),
        opening_date: normalizeDateToApi(openingDate),
        regime: regime.trim(),
      };

      await apiPost("/api/v1/organizations", payload);
      logAction("Organização criada", payload.name);
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

  const filtered = useMemo(() => {
    const base = status === "all" ? orgs : orgs.filter((o) => o.status === status);
    const q = search.trim().toLowerCase();

    if (!q) return base;

    return base.filter((o) =>
      [
        o.name,
        o.document,
        o.cnae,
        o.address,
        o.regime,
        o.opening_date,
        String(o.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orgs, status, search]);

  const totalAtivas = useMemo(() => orgs.filter((o) => o.status === "active").length, [orgs]);
  const totalInativas = useMemo(
    () => orgs.filter((o) => o.status === "inactive" || o.status === "paused").length,
    [orgs]
  );
  const totalLixeira = useMemo(() => orgs.filter((o) => o.status === "trashed").length, [orgs]);

  return (
    <main className="container">
      <div className="header-row">
        <div>
          <h1 style={{ color: "var(--primary)" }}>Organizações</h1>
          <p className="muted">
            {orgs.length} total · {totalAtivas} ativas · {totalInativas} inativas · {totalLixeira} na lixeira
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Nova"}
          </button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => loadOrgs()}>
            Atualizar
          </button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => router.back()}>
            ← Voltar
          </button>
        </div>
      </div>

      {message && (
        <p
          className={
            message.toLowerCase().includes("erro") || message.toLowerCase().includes("falhou")
              ? "error"
              : "success"
          }
        >
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
              <input value={document} onChange={(e) => setDocument(e.target.value)} required />
            </div>

            <div>
              <label>Endereço</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div>
              <label>CNAE Principal</label>
              <input
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
                placeholder="Ex.: 8299-7/99 - descrição"
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
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={status === "all" ? "btn-active" : "btn-ghost"}
              onClick={() => setStatus("all")}
            >
              Todas
            </button>
            <button
              className={status === "active" ? "btn-active" : "btn-ghost"}
              onClick={() => setStatus("active")}
            >
              Ativas
            </button>
            <button
              className={status === "inactive" ? "btn-active" : "btn-ghost"}
              onClick={() => setStatus("inactive")}
            >
              Inativas
            </button>
            <button
              className={status === "trashed" ? "btn-active" : "btn-ghost"}
              onClick={() => setStatus("trashed")}
            >
              Lixeira
            </button>
          </div>

          <div style={{ minWidth: 280, flex: "1 1 320px", maxWidth: 420 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ, CNAE, endereço..."
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {loadingPage ? (
          <p>Carregando organizações...</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {filtered.map((o) => (
              <section
                key={o.id}
                className="card"
                style={{
                  marginBottom: 0,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  padding: "9px 12px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 1.5fr) minmax(150px, 0.9fr) minmax(190px, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    style={{
                      textDecoration: "none",
                      color: "var(--text)",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: "var(--primary)" }}>
                      {o.name}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>ID {o.id}</div>
                  </Link>

                  <div style={{ display: "grid", gap: 2, fontSize: 12 }}>
                    <div>
                      <strong style={{ color: "var(--muted)", fontWeight: 500 }}>CNPJ: </strong>
                      <span className="muted">{o.document || "—"}</span>
                    </div>
                    <div>
                      <strong style={{ color: "var(--muted)", fontWeight: 500 }}>Abertura: </strong>
                      <span className="muted">
                        {formatDateBR(o.opening_date) || "—"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 2, fontSize: 12 }}>
                    <div>
                      <strong style={{ color: "var(--muted)", fontWeight: 500 }}>CNAE: </strong>
                      <span className="muted">{shortText(o.cnae || "—", 60)}</span>
                    </div>
                    <div>
                      <strong style={{ color: "var(--muted)", fontWeight: 500 }}>Endereço: </strong>
                      <span className="muted">
                        {shortText(o.address || "—", 68)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${statusColor(o.status)}18`,
                        color: statusColor(o.status),
                        border: `1px solid ${statusColor(o.status)}60`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {orgStatusLabel(o.status)}
                    </span>

                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {o.status === "trashed" ? (
                        <>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => restoreOrg(o.id)}>
                            Restaurar
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)", borderColor: "rgba(220,38,38,0.3)" }}
                            onClick={() => permanentlyDeleteOrg(o.id, o.name)}
                          >
                            Excluir
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => toggleOrgStatus(o.id, o.status)}
                          >
                            {o.status === "active" ? "Pausar" : "Ativar"}
                          </button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => moveOrgToTrash(o.id)}>
                            Lixeira
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            {!filtered.length && (
              <section className="card" style={{ marginBottom: 0 }}>
                Nenhuma organização encontrada.
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
