"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

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

export default function AdminLotsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    loadLots();
  }, [user, isLoading]);

  async function loadLots() {
    try {
      const data = await apiGet("/api/v1/lots");
      setLots((data as Lot[]) || []);
    } catch {
      setLots([]);
    } finally {
      setLoading(false);
    }
  }

  function createSlug(lot: Lot) {
    return (lot.title || `lote-${lot.id}`)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  return (
    <main className="container">
      <div className="header-row">
        <h1>Lotes</h1>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {lots.map((l) => {
            const slug = createSlug(l);

            return (
              <Link
                key={l.id}
                href={`/admin/organizations/${l.organization_id}/lots/${l.id}-${slug}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "#fff",
                  padding: "14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <strong>
                  {l.title || `Lote ${l.id}`} — ID {l.id}
                </strong>

                <span>Status: {l.status}</span>
                <span>Total: {l.total_badges}</span>
                <span>Emitidos: {l.issued}</span>
                <span>Saldo: {l.remaining}</span>
                <span>Validade (dias): {l.issue_window_days}</span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
