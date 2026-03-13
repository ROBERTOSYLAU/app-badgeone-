"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { getRole } from "../../../../lib/auth";

type Cred = { id: number; recipient_name: string; course_name: string; status: string; organization_id: number; lot_id: number };
type Org = { id: number; name: string };

export default function AdminEmissionsPage() {
  const router = useRouter();
  const [creds, setCreds] = useState<Cred[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    if (getRole() !== "admin") return router.push('/login');
    Promise.all([apiGet('/api/v1/credentials'), apiGet('/api/v1/organizations')]).then(([c, o]) => { setCreds(c); setOrgs(o); }).catch(() => router.push('/admin'));
  }, [router]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Badges emitidos</h1>
        <button className="btn-ghost" onClick={() => router.push('/admin')}>← Voltar</button>
      </div>
      <section className="card">
        <ul className="list">
          {creds.map((c, i) => {
            const org = orgs.find((o) => o.id === c.organization_id);
            return <li key={c.id}>{i + 1}. {c.recipient_name} | {c.course_name} | Empresa {org?.name || c.organization_id} | Lote {c.lot_id} | {c.status}</li>;
          })}
          {!creds.length && <li>Nenhum badge emitido.</li>}
        </ul>
      </section>
    </main>
  );
}
