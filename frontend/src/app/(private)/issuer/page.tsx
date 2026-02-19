"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../lib/api";
import { getRole, logout } from "../../../lib/auth";

type Lot = { id: number; organization_id: number; total_badges: number; issued: number; remaining: number; issue_window_days: number; status: string };
type Org = { id: number; name: string; document?: string; status: string };
type Cred = { id: number; public_id: string; recipient_name: string; course_name: string; status: string; tx_hash: string; token_id: string };

export default function IssuerDashboard() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [creds, setCreds] = useState<Cred[]>([]);

  const [organizationId, setOrganizationId] = useState("");
  const [lotId, setLotId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [courseName, setCourseName] = useState("");
  const [result, setResult] = useState<string>("");

  async function loadData() {
    const [lotsData, orgsData, credsData] = await Promise.all([
      apiGet("/api/v1/lots"),
      apiGet("/api/v1/organizations"),
      apiGet("/api/v1/credentials"),
    ]);
    setLots(lotsData);
    setOrgs(orgsData);
    setCreds(credsData);
  }

  useEffect(() => {
    const role = getRole();
    if (role !== "issuer" && role !== "admin") {
      router.push("/login");
      return;
    }
    loadData().catch(() => router.push("/login"));
  }, [router]);

  async function issueCredential(e: React.FormEvent) {
    e.preventDefault();
    setResult("");

    try {
      const data = await apiPost("/api/v1/credentials/issue", {
        organization_id: Number(organizationId),
        lot_id: Number(lotId),
        recipient_name: recipientName,
        recipient_email: recipientEmail || null,
        course_name: courseName,
      });

      setResult(`Emitido com sucesso | public_id: ${data.public_id} | tx: ${data.tx_hash.slice(0, 18)}...`);
      setRecipientName("");
      setRecipientEmail("");
      setCourseName("");
      await loadData();
    } catch {
      setResult("Erro ao emitir (valide lote/saldo/login).");
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Emissor Dashboard</h1>
        <button onClick={() => { logout(); router.push('/login'); }}>Sair</button>
      </div>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <h2>Emitir Badge (Sprint 2)</h2>
        <form onSubmit={issueCredential} style={{ display: "grid", gap: 8, maxWidth: 640 }}>
          <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} required>
            <option value="">Selecione a organização</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <select value={lotId} onChange={(e) => setLotId(e.target.value)} required>
            <option value="">Selecione o lote</option>
            {lots.filter(l => !organizationId || l.organization_id === Number(organizationId)).map((l) => (
              <option key={l.id} value={l.id}>Lote #{l.id} | saldo {l.remaining}</option>
            ))}
          </select>

          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nome do ganhador" required />
          <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="Email do ganhador (opcional)" />
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Curso/Programa" required />

          <button type="submit">Emitir credencial</button>
        </form>
        {result && <p style={{ marginTop: 10, color: "#9fd7ff" }}>{result}</p>}
      </section>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <h2>Lotes disponíveis</h2>
        <ul>
          {lots.map((l) => (
            <li key={l.id}>
              Lote #{l.id} | Org {l.organization_id} | Saldo {l.remaining}/{l.total_badges} | Janela {l.issue_window_days} dias
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16 }}>
        <h2>Últimas credenciais</h2>
        <ul>
          {creds.map((c) => (
            <li key={c.id}>
              {c.recipient_name} | {c.course_name} | <code>{c.public_id}</code> | <a href={`/verify/${c.public_id}`}>verificar</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
