"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../../lib/api";
import { getRole, logout } from "../../../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };
type Lot = { id: number; organization_id: number; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
type Note = { id: number; organization_id: number; title: string; content: string; created_at?: string };
type Cred = { id: number; organization_id: number; lot_id: number; public_id: string; recipient_name: string; course_name: string; status: string };

type TabKey = "overview" | "active" | "revoked" | "notes";

export default function OrganizationDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [credentials, setCredentials] = useState<Cred[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [noteTitle, setNoteTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

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
    if (getRole() !== "admin") {
      router.push("/login");
      return;
    }

    loadAll().catch(() => router.push("/admin"));
  }, [orgId, router]);

  const activeLots = useMemo(() => lots.filter((l) => l.status === "active" || l.status === "paused"), [lots]);
  const revokedLots = useMemo(() => lots.filter((l) => l.status === "revoked" || l.status === "finished"), [lots]);

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
    const ack = window.prompt(`Excluir geral a organização ${org.name}. Digite EXCLUIR para confirmar:`);
    if (ack !== "EXCLUIR") return;

    try {
      await apiDelete(`/api/v1/organizations/${org.id}?force=true`);
      setMessage("Organização excluída do sistema.");
      setTimeout(() => router.push("/admin"), 700);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir organização.";
      setMessage(msg);
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

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organização</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => router.push("/admin")}>← Voltar</button>
          <button className="btn-ghost" onClick={() => { logout(); router.push('/'); }}>Sair</button>
        </div>
      </div>

      {!org && <p className="error">Organização não encontrada.</p>}

      {message && <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>}

      {org && (
        <>
          <section className="card">
            <h2>{org.name}</h2>
            <p><strong>ID:</strong> #{org.id}</p>
            <p><strong>CNPJ:</strong> {org.document || "não informado"}</p>
            <p><strong>Status:</strong> {org.status}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {org.status === "active" ? (
                <button className="btn-ghost" onClick={deactivateOrganization}>Pausar organização</button>
              ) : (
                <button className="btn-ghost" onClick={activateOrganization}>Ativar organização</button>
              )}
              <button className="btn-ghost" onClick={deleteOrganization}>Excluir geral do sistema</button>
            </div>
          </section>

          <section className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button className="btn-ghost" onClick={() => setTab("overview")}>Visão geral</button>
              <button className="btn-ghost" onClick={() => setTab("active")}>Lotes ativos</button>
              <button className="btn-ghost" onClick={() => setTab("revoked")}>Lotes revogados/finalizados</button>
              <button className="btn-ghost" onClick={() => setTab("notes")}>Anotações</button>
            </div>

            {tab === "overview" && (
              <div>
                <p><strong>Total de lotes:</strong> {lots.length}</p>
                <p><strong>Total emitido:</strong> {lots.reduce((a, b) => a + b.issued, 0)}</p>
                <p><strong>Saldo total:</strong> {lots.reduce((a, b) => a + b.remaining, 0)}</p>
              </div>
            )}

            {tab === "active" && (
              <div className="form-grid">
                <ul className="list">
                  {activeLots.map((l) => (
                    <li key={l.id}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span>Lote #{l.id} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining} | Status {l.status}</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn-ghost" onClick={() => {
                            const v = window.prompt("Novo total de badges:", String(l.total_badges));
                            if (!v) return;
                            const n = Number(v);
                            if (Number.isNaN(n)) return;
                            updateLot(l.id, { total_badges: n });
                          }}>Editar quantidade</button>
                          {l.status === "active" ? (
                            <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "paused" })}>Pausar lote</button>
                          ) : (
                            <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "active" })}>Ativar lote</button>
                          )}
                          <button className="btn-ghost" onClick={() => updateLot(l.id, { status: "revoked" })}>Revogar lote</button>
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
                          <button className="btn-ghost" onClick={() => updateCredential(c.id, "revoked")}>Revogar</button>
                          <button className="btn-ghost" onClick={() => updateCredential(c.id, "valid")}>Ativar</button>
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
                  <li key={l.id}>Lote #{l.id} | Status {l.status} | Emitidos {l.issued}</li>
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
          </section>
        </>
      )}
    </main>
  );
}
