"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../../lib/api";
import { getRole, logout } from "../../../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };
type Lot = { id: number; organization_id: number; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };

type TabKey = "overview" | "active" | "revoked" | "notes";

export default function OrganizationDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (getRole() !== "admin") {
      router.push("/login");
      return;
    }

    Promise.all([apiGet("/api/v1/organizations"), apiGet("/api/v1/lots")])
      .then(([orgs, allLots]) => {
        const id = Number(params.id);
        setOrg((orgs as Org[]).find((o) => o.id === id) || null);
        setLots((allLots as Lot[]).filter((l) => l.organization_id === id));
      })
      .catch(() => router.push("/admin"));
  }, [params.id, router]);

  const activeLots = useMemo(() => lots.filter((l) => l.status === "active"), [lots]);
  const revokedLots = useMemo(() => lots.filter((l) => l.status !== "active"), [lots]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organização</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn-ghost" href="/admin">Voltar</Link>
          <button className="btn-ghost" onClick={() => { logout(); router.push('/login'); }}>Sair</button>
        </div>
      </div>

      {!org && <p className="error">Organização não encontrada.</p>}

      {org && (
        <>
          <section className="card">
            <h2>{org.name}</h2>
            <p><strong>ID:</strong> #{org.id}</p>
            <p><strong>CNPJ:</strong> {org.document || "não informado"}</p>
            <p><strong>Status:</strong> {org.status}</p>
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
              <ul className="list">
                {activeLots.map((l) => (
                  <li key={l.id}>Lote #{l.id} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}</li>
                ))}
                {!activeLots.length && <li>Nenhum lote ativo.</li>}
              </ul>
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
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas desta organização..."
                  style={{ minHeight: 140, borderRadius: 8, padding: 10, background: "#0a163e", color: "#fff", border: "1px solid #2a3b73" }}
                />
                <p className="muted">Anotações locais da sessão (próxima etapa: persistir no backend).</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
