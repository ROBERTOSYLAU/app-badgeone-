"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../lib/api";
import { getRole, logout } from "../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };
type Lot = { id: number; organization_id: number; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };

export default function AdminDashboard() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgDoc, setOrgDoc] = useState("");
  const [lotOrgId, setLotOrgId] = useState("");
  const [lotTotal, setLotTotal] = useState("600");

  async function loadData() {
    const [o, l] = await Promise.all([
      apiGet("/api/v1/organizations"),
      apiGet("/api/v1/lots"),
    ]);
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

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/v1/organizations", { name: orgName, document: orgDoc || null });
    setOrgName("");
    setOrgDoc("");
    await loadData();
  }

  async function createLot(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/v1/lots", {
      organization_id: Number(lotOrgId),
      total_badges: Number(lotTotal),
      issue_window_days: 365,
    });
    setLotOrgId("");
    await loadData();
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin Dashboard</h1>
        <button onClick={() => { logout(); router.push('/login'); }}>Sair</button>
      </div>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <h2>Criar Organização</h2>
        <form onSubmit={createOrg} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nome da organização" required />
          <input value={orgDoc} onChange={(e) => setOrgDoc(e.target.value)} placeholder="CNPJ (opcional)" />
          <button type="submit">Salvar organização</button>
        </form>
      </section>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <h2>Criar Lote de Badges</h2>
        <form onSubmit={createLot} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
          <select value={lotOrgId} onChange={(e) => setLotOrgId(e.target.value)} required>
            <option value="">Selecione a organização</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <input value={lotTotal} onChange={(e) => setLotTotal(e.target.value)} type="number" min={1} required />
          <button type="submit">Criar lote</button>
        </form>
      </section>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <h2>Organizações</h2>
        <ul>
          {orgs.map((o) => <li key={o.id}>#{o.id} {o.name} ({o.status})</li>)}
        </ul>
      </section>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16 }}>
        <h2>Lotes</h2>
        <ul>
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
