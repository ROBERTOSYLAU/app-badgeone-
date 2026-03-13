"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { getRole } from "../../../../lib/auth";

type Org = { id: number; name: string; document?: string; status: string };

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const status = search.get("status") || "all";

  useEffect(() => {
    if (getRole() !== "admin") return router.push("/login");
    apiGet("/api/v1/organizations").then(setOrgs).catch(() => router.push("/admin"));
  }, [router]);

  const filtered = useMemo(() => status === "all" ? orgs : orgs.filter((o) => o.status === status), [orgs, status]);

  return (
    <main className="container">
      <div className="header-row">
        <h1>Organizações ({status})</h1>
        <button className="btn-ghost" onClick={() => router.push('/admin')}>← Voltar</button>
      </div>
      <section className="card">
        <ul className="list">
          {filtered.map((o, i) => (
            <li key={o.id}><Link href={`/admin/organizations/${o.id}`}>{i + 1}. {o.name}</Link> <span className="muted">({o.status})</span></li>
          ))}
          {!filtered.length && <li>Nenhuma organização.</li>}
        </ul>
      </section>
    </main>
  );
}
