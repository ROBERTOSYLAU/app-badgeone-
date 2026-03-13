"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { getRole } from "../../../../lib/auth";

type Lot = { id: number; organization_id: number; title?: string; total_badges: number; issued: number; remaining: number; status: string };
type Org = { id: number; name: string };

export default function AdminLotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("status") || "all";
      setStatus(s);
    }
    if (getRole() !== "admin") return router.push('/login');
    Promise.all([apiGet('/api/v1/lots'), apiGet('/api/v1/organizations')]).then(([l, o]) => { setLots(l); setOrgs(o); }).catch(() => router.push('/admin'));
  }, [router]);

  const filtered = useMemo(() => status === "all" ? lots : lots.filter((l) => l.status === status), [lots, status]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Lotes ({status})</h1>
        <button className="btn-ghost" onClick={() => router.push('/admin')}>← Voltar</button>
      </div>
      <section className="card">
        <ul className="list">
          {filtered.map((l, i) => {
            const org = orgs.find((o) => o.id === l.organization_id);
            return <li key={l.id}>{i + 1}. {l.title || `Lote #${l.id}`} | Empresa {org?.name || l.organization_id} | Total {l.total_badges} | Emitidos {l.issued} | Saldo {l.remaining}</li>;
          })}
          {!filtered.length && <li>Nenhum lote.</li>}
        </ul>
      </section>
    </main>
  );
}
