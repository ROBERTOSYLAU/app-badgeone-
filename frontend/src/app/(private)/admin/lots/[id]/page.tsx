"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../../lib/api";

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  status: string;
  total_badges: number;
  issued: number;
  remaining: number;
  issue_window_days: number;
};

export default function LotDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [lot, setLot] = useState<Lot | null>(null);

  const rawId = params.id;
  const id = Number(rawId.split("-")[0]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await apiGet("/api/v1/lots");
    const found = (data as Lot[]).find((l) => l.id === id);
    setLot(found || null);
  }

  if (!lot) {
    return <p>Lote não encontrado</p>;
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>{lot.title || `Lote ${lot.id}`}</h1>

        <button
          className="btn-ghost"
          onClick={() =>
            router.push(`/admin/organizations/${lot.organization_id}`)
          }
        >
          ← Voltar
        </button>
      </div>

      <section className="card">
        <p>ID: {lot.id}</p>
        <p>Status: {lot.status}</p>
        <p>Total: {lot.total_badges}</p>
        <p>Emitidos: {lot.issued}</p>
        <p>Saldo: {lot.remaining}</p>
        <p>Validade (dias): {lot.issue_window_days}</p>
      </section>
    </main>
  );
}
