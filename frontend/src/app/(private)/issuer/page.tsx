"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type Lot = { id: number; title?: string; organization_id: number; total_badges: number; issued: number; remaining: number; status: string };
type Cred = { id: number; public_id: string; recipient_name: string; course_name: string; status: string; created_at?: string };

export default function IssuerDashboard() {
  const { user } = useAuth();
  const [lots, setLots] = useState<Lot[]>([]);
  const [creds, setCreds] = useState<Cred[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGet("/api/v1/lots"), apiGet("/api/v1/credentials")])
      .then(([lotsData, credsData]) => {
        setLots(lotsData);
        setCreds(credsData);
      })
      .finally(() => setLoading(false));
  }, []);

  const myLots = lots.filter((l) => l.organization_id === user?.organization_id);
  const totalSaldo = myLots.reduce((s, l) => s + l.remaining, 0);
  const totalEmitidos = myLots.reduce((s, l) => s + l.issued, 0);
  const recentCreds = creds.slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  if (loading) return (
    <div style={{ padding: 40, color: "var(--text-primary, #111)" }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary, #111)", margin: 0 }}>
          {greeting}, {user?.name?.split(" ")[0] || "Emissor"} 👋
        </h1>
        <p style={{ color: "var(--text-secondary, #666)", fontSize: 14, margin: "4px 0 0" }}>
          {user?.organization_name}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Badges disponíveis" value={totalSaldo} color="#1A3A5C" />
        <StatCard label="Badges emitidos" value={totalEmitidos} color="#0f766e" />
        <StatCard label="Lotes ativos" value={myLots.filter((l) => l.status === "active").length} color="#7c3aed" />
      </div>

      {/* Quick action */}
      <Link
        href="/issuer/emit"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#1A3A5C",
          color: "#fff",
          borderRadius: 8,
          padding: "10px 20px",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 28,
        }}
      >
        <span>🎖️</span> Emitir novo badge
      </Link>

      {/* Lotes */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary, #111)", marginBottom: 12 }}>
          Meus lotes
        </h2>
        {myLots.length === 0 ? (
          <p style={{ color: "var(--text-secondary, #888)", fontSize: 13 }}>Nenhum lote disponível.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {myLots.map((l) => (
              <div
                key={l.id}
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary, #111)" }}>
                  {l.title || `Lote #${l.id}`}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary, #666)" }}>
                  {l.remaining}/{l.total_badges} disponíveis
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Últimas emissões */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary, #111)", margin: 0 }}>
            Últimas emissões
          </h2>
          <Link href="/issuer/credentials" style={{ fontSize: 12, color: "#1A3A5C", textDecoration: "none" }}>
            Ver todas →
          </Link>
        </div>
        {recentCreds.length === 0 ? (
          <p style={{ color: "var(--text-secondary, #888)", fontSize: 13 }}>Nenhuma credencial emitida ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentCreds.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary, #111)" }}>
                    {c.recipient_name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary, #666)" }}>{c.course_name}</div>
                </div>
                <Link
                  href={`/verify/${c.public_id}`}
                  style={{ fontSize: 11, color: "#1A3A5C", textDecoration: "none" }}
                >
                  verificar
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
