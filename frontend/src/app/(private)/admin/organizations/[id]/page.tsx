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
};
type Lot = { id: number; organization_id: number; title?: string; description?: string; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };

function getStatusColor(status: string) {
  switch (status) {
    case "active": return "#22c55e"; // verde
    case "paused": return "#f59e0b"; // amarelo
    case "revoked": return "#ef4444"; // vermelho
    case "finished": return "#6b7280"; // cinza
    case "trashed": return "#374151"; // cinza escuro
    default: return "#9ca3af";
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    paused: "Pausado",
    revoked: "Revogado",
    finished: "Finalizado",
    trashed: "Lixeira",
  };
  return map[status] || status;
}
type Note = { id: number; organization_id: number; title: string; content: string; created_at?: string };
type Cred = { id: number; organization_id: number; lot_id: number; public_id: string; recipient_name: string; course_name: string; status: string };

type TabKey = "overview" | "active" | "revoked" | "notes" | "trash";

export default function OrganizationDetailsPage({ params }: { params: { id: string } }) {
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
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCnae, setEditCnae] = useState("");
  const [editOpeningDate, setEditOpeningDate] = useState("");
  const [editRegime, setEditRegime] = useState("");
  
  // Create lot modal state
  const [showCreateLot, setShowCreateLot] = useState(false);
  const [lotTitle, setLotTitle] = useState("");
  const [lotDescription, setLotDescription] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");

  const orgId = Number(params.id);

  async function loadAll() {
    const [orgs, allLots, allNotes, creds] = await Promise.all([
      apiGet("/api/v1/organizations"),
      apiGet("/api/v1/lots"),
      apiGet(`/api/v1/organization-notes/${orgId}`),
      apiGet(`/api/v1/credentials?organization_id=${orgId}`),
    ]);
    setOrg((orgs as Org[]).find((o) => o.id === orgId) || null);
    setLots((allLots as Lot[]).filter((l) => l.organization_id === orgId));
    setNotesList((allNotes as Note[]) || []);
    setCredentials((creds as Cred[]) || []);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }
    loadAll().catch(() => router.push("/admin"));
  }, [user, isLoading, orgId, router]);

  const activeLots = useMemo(() => lots.filter((l) => l.status === "active" || l.status === "paused"), [lots]);
  const revokedLots = useMemo(() => lots.filter((l) => l.status === "revoked" || l.status === "finished"), [lots]);
  const trashedLots = useMemo(() => lots.filter((l) => l.status === "trashed"), [lots]);
  const trashedCreds = useMemo(() => credentials.filter((c) => c.status === "trashed"), [credentials]);

  async function deactivateOrganization() {
    if (!org) return;
    const ok = window.confirm(`Pausar organização ${org.name}?`);
    if (!ok) return;

    try {
      await apiPost(`/api/v1/organizations/${org.id}/deactivate`, {});
      setMessage("Organização pausada com sucesso.");
      setOrg({ ...org, status: "inactive" });
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
      setOrg({ ...org, status: "active" });
    } catch {
      setMessage("Erro ao ativar organização.");
    }
  }

  async function deleteOrganization() {
    if (!org) return;
    const ack = window.prompt(`Mover organização ${org.name} para lixeira. Digite EXCLUIR para confirmar:`);
    if (ack !== "EXCLUIR") return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}`);
      setMessage("Organização movida para lixeira.");
      setOrg({ ...org, status: "trashed" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao mover para lixeira.";
      setMessage(msg);
    }
  }

  async function restoreOrganization() {
    if (!org) return;
    try {
      await apiPost(`/api/v1/organizations/${org.id}/restore`, {});
      setMessage("Organização restaurada.");
      setOrg({ ...org, status: "active" });
    } catch {
      setMessage("Erro ao restaurar organização.");
    }
  }

  async function saveNote() {
    if (!notes.trim()) return;
    try {
      await apiPost(`/api/v1/organization-notes/${orgId}`, { title: noteTitle || null, content: notes });
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

  async function updateLot(lotId: number, patch: { total_badges?: number; status?: string }) {
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
    const mode = window.prompt("Tipo de revogação: FULL (total) ou PARTIAL (parcial)", "PARTIAL");
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

    const qtyInput = window.prompt("Quantidade a revogar (somente saldo não emitido)", "1");
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty <= 0) return;
    const ack = window.prompt(`Digite REVOGAR para confirmar revogação parcial de ${qty}`);
    if (ack !== "REVOGAR") return;

    await apiPost(`/api/v1/lots/${l.id}/revoke`, { mode: "partial", quantity: qty });
    await loadAll();
    setMessage("Revogação parcial concluída.");
  }

  async function recoverLotFlow(l: Lot) {
    const ack = window.prompt(`Digite RECUPERAR para confirmar recuperação do lote ${l.title || '#' + l.id}`);
    if (ack !== "RECUPERAR") return;
    const qtyInput = window.prompt("Quantidade para recuperar (opcional)", "0");
    const qty = qtyInput && !Number.isNaN(Number(qtyInput)) ? Number(qtyInput) : 0;
    await apiPost(`/api/v1/lots/${l.id}/recover`, { quantity: qty, to_status: "active" });
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
    setEditAddress((org as any).address || "");
    setEditCnae((org as any).cnae || "");
    setEditOpeningDate((org as any).opening_date || "");
    setEditRegime((org as any).regime || "");
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
      loadAll();
    } catch {
      setMessage("Erro ao atualizar organização.");
    }
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(lotQuantity);
    if (!qty || qty <= 0) {
      setMessage("Quantidade deve ser maior que 0");
      return;
    }
    try {
      await apiPost("/api/v1/lots", {
        organization_id: orgId,
        title: lotTitle || `Lote ${new Date().toLocaleDateString('pt-BR')}`,
        description: lotDescription,
        total_badges: qty,
      });
      setMessage("Lote criado com sucesso!");
      setShowCreateLot(false);
      setLotTitle("");
      setLotDescription("");
      setLotQuantity("");
      loadAll();
    } catch {
      setMessage("Erro ao criar lote.");
    }
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organização</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => router.push("/admin/organizations")}>← Voltar</button>
          <button className="btn-ghost" onClick={() => { logout(); router.push('/'); }}>Sair</button>
        </div>
      </div>

      {!org && <p className="error">Organização não encontrada.</p>}

      {message && <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>}

      {isEditing && org && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>Editar Organização</h2>
          <form onSubmit={saveEdit}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label>Razão Social</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <label>CNPJ</label>
                <input value={editDocument} onChange={(e) => setEditDocument(e.target.value)} />
              </div>
              <div>
                <label>Endereço</label>
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>CNAE Principal</label>
                  <input value={editCnae} onChange={(e) => setEditCnae(e.target.value)} />
                </div>
                <div>
                  <label>Data de Abertura</label>
                  <input value={editOpeningDate} onChange={(e) => setEditOpeningDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label>Natureza Jurídica</label>
                <input value={editRegime} onChange={(e) => setEditRegime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit">Salvar Alterações</button>
              <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>Cancelar</button>
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
                <input value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Ex: Lote Março 2024" />
              </div>
              <div>
                <label>Descrição (opcional)</label>
                <input value={lotDescription} onChange={(e) => setLotDescription(e.target.value)} placeholder="Descrição do lote" />
              </div>
              <div>
                <label>Quantidade de Badges *</label>
                <input type="number" value={lotQuantity} onChange={(e) => setLotQuantity(e.target.value)} placeholder="100" required min="1" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit">Criar Lote</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreateLot(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {org && (
        <>
          <section className="card">
            <h2>{org.name}</h2>
            <p><strong>ID:</strong> #{org.id}</p>
            <p><strong>CNPJ:</strong> {org.document || "não informado"}</p>
            <p><strong>Status:</strong> {org.status}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-ghost" onClick={startEditing}>✏️ Editar</button>
              <button className="btn-ghost" onClick={() => setShowCreateLot(true)}>📦 Criar Lote</button>
              {org.status === "active" ? (
                <button className="btn-ghost" onClick={deactivateOrganization}>⏸️ Pausar</button>
              ) : org.status === "trashed" ? (
                <button className="btn-ghost" onClick={restoreOrganization}>🔄 Restaurar</button>
              ) : (
                <button className="btn-ghost" onClick={activateOrganization}>▶️ Ativar</button>
              )}
              <button className="btn-ghost" onClick={deleteOrganization}>🗑️ Lixeira</button>
            </div>
          </section>

          <section className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button className={tab === "overview" ? "btn-active" : "btn-ghost"} onClick={() => setTab("overview")}>Visão geral</button>
              <button className={tab === "active" ? "btn-active" : "btn-ghost"} onClick={() => setTab("active")}>Lotes ativos</button>
              <button className={tab === "revoked" ? "btn-active" : "btn-ghost"} onClick={() => setTab("revoked")}>Lotes revogados/finalizados</button>
              <button className={tab === "notes" ? "btn-active" : "btn-ghost"} onClick={() => setTab("notes")}>Anotações</button>
              <button className={tab === "trash" ? "btn-active" : "btn-ghost"} onClick={() => setTab("trash")}>Lixeira</button>
            </div>

            {tab === "overview" && (
              <div className="form-grid">
                <div>
                  <p><strong>Total de lotes:</strong> {lots.length}</p>
                  <p><strong>Total emitido:</strong> {lots.reduce((a, b) => a + b.issued, 0)}</p>
                  <p><strong>Saldo total:</strong> {lots.reduce((a, b) => a + b.remaining, 0)}</p>
                </div>
                <div className="card" style={{ marginBottom: 0 }}>
                  <h2 style={{ fontSize: 16 }}>Lotes da organização ({lots.length})</h2>
                  <ul className="list">
                    {lots.map((l, i) => (
                      <li key={l.id}>
                        {i + 1}. <Link className="lot-title-highlight" href={`/admin/lots/${l.id}`}>{l.title || `Lote #${l.id}`}</Link>
                        <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 12, background: getStatusColor(l.status) + "20", color: getStatusColor(l.status), border: `1px solid ${getStatusColor(l.status)}` }}>
                          {getStatusLabel(l.status)}
                        </span>
                        <span className="muted"> | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}</span>
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
                          <Link className="lot-title-highlight" href={`/admin/lots/${l.id}`}>{(l.title || `Lote #${l.id}`).toUpperCase()}</Link>
                          <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 12, background: getStatusColor(l.status) + "20", color: getStatusColor(l.status), border: `1px solid ${getStatusColor(l.status)}` }}>
                            {getStatusLabel(l.status)}
                          </span>
                          <span className="muted"> | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}</span>
                        </span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn-ghost" onClick={() => router.push(`/admin/lots/${l.id}`)}>Editar quantidade</button>
                          {l.status === "active" ? (
                            <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "paused" })}>Pausar lote</button>
                          ) : (
                            <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "active" })}>Ativar lote</button>
                          )}
                          <button className="btn-ghost" onClick={() => revokeLotFlow(l)}>Revogar lote</button>
                          <button className="btn-ghost" onClick={() => {
                            const ack = window.prompt("Digite EXCLUIR para enviar lote à lixeira");
                            if (ack !== "EXCLUIR") return;
                            updateLot(l.id, { status: "trashed" });
                          }}>Lixeira</button>
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
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                          <button className="btn-ghost" onClick={() => updateCredential(c.id, "paused")}>Pausar</button>
                          <button className="btn-ghost" onClick={() => {
                            const ack = window.prompt("Digite REVOGAR para confirmar revogação da credencial");
                            if (ack !== "REVOGAR") return;
                            updateCredential(c.id, "revoked");
                          }}>Revogar</button>
                          <button className="btn-ghost" onClick={() => updateCredential(c.id, "valid")}>Ativar</button>
                          <button className="btn-ghost" onClick={() => {
                            const ack = window.prompt("Digite EXCLUIR para mover a credencial para lixeira");
                            if (ack !== "EXCLUIR") return;
                            updateCredential(c.id, "trashed");
                          }}>Lixeira</button>
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
                    <Link className="lot-title-highlight" href={`/admin/lots/${l.id}`}>{l.title || `Lote #${l.id}`}</Link>
                    <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 12, background: getStatusColor(l.status) + "20", color: getStatusColor(l.status), border: `1px solid ${getStatusColor(l.status)}` }}>
                      {getStatusLabel(l.status)}
                    </span>
                    <span className="muted"> | Emitidos {l.issued} | Total {l.total_badges}</span>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn-ghost" onClick={() => router.push(`/admin/lots/${l.id}`)}>Editar quantidade</button>
                      <button className="btn-ghost" onClick={() => recoverLotFlow(l)}>Recuperar lote</button>
                    </div>
                  </li>
                ))}
                {!revokedLots.length && <li>Nenhum lote revogado/finalizado.</li>}
              </ul>
            )}

            {tab === "notes" && (
              <div className="form-grid" style={{ maxWidth: 760 }}>
                <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Título (opcional)" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas desta organização..."
                  style={{ minHeight: 140, borderRadius: 8, padding: 10, background: "#0a163e", color: "#fff", border: "1px solid #2a3b73" }}
                />
                <button onClick={saveNote}>Salvar anotação</button>
                <p className="muted">Total de anotações: {notesList.length}</p>
                <ul className="list">
                  {notesList.map((n, i) => (
                    <li key={n.id}>
                      <strong>{i + 1}. {n.title}</strong> <span className="muted">({n.created_at?.slice(0, 10) || "-"})</span>
                      <p>{n.content}</p>
                      <button className="btn-ghost" onClick={() => removeNote(n.id)}>Excluir anotação</button>
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
                        <Link className="lot-title-highlight" href={`/admin/lots/${l.id}`}>{l.title || `Lote #${l.id}`}</Link>
                        <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 12, background: getStatusColor(l.status) + "20", color: getStatusColor(l.status), border: `1px solid ${getStatusColor(l.status)}` }}>
                          {getStatusLabel(l.status)}
                        </span>
                        <span className="muted"> | Total {l.total_badges} | Emitidos {l.issued}</span>
                        <div style={{ marginTop: 6 }}>
                          <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "active" })}>Restaurar lote</button>
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
                          <button className="btn-ghost" onClick={() => updateCredential(c.id, "valid")}>Restaurar credencial</button>
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
