"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type OnboardingStatus = {
  has_organization: boolean;
  has_issuer_user: boolean;
  has_lot: boolean;
  has_emission: boolean;
  organization_count: number;
  issuer_count: number;
  lot_count: number;
  emission_count: number;
  completed: boolean;
  next_step: string;
};

type Org = {
  id: number;
  name: string;
  status: string;
};

type Lot = {
  id: number;
  organization_id: number;
  title?: string;
  status: string;
  total_badges: number;
  issued: number;
  remaining?: number;
  issue_window_days?: number;
};

type Credential = {
  id: number;
  organization_id?: number;
  lot_id?: number;
  status?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [oRes, lRes, obRes, cRes] = await Promise.allSettled([
        apiGet("/api/v1/organizations"),
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/auth/onboarding-status"),
        apiGet("/api/v1/credentials"),
      ]);

      if (oRes.status === "fulfilled") {
        setOrgs((oRes.value as Org[]) || []);
      } else {
        console.error("Erro ao carregar organizações:", oRes.reason);
        setOrgs([]);
      }

      if (lRes.status === "fulfilled") {
        setLots((lRes.value as Lot[]) || []);
      } else {
        console.error("Erro ao carregar lotes:", lRes.reason);
        setLots([]);
      }

      if (obRes.status === "fulfilled") {
        setOnboarding((obRes.value as OnboardingStatus) || null);
      } else {
        console.error("Erro ao carregar onboarding:", obRes.reason);
        setOnboarding(null);
      }

      if (cRes.status === "fulfilled") {
        setCredentials((cRes.value as Credential[]) || []);
      } else {
        console.error("Erro ao carregar credenciais:", cRes.reason);
        setCredentials([]);
      }
    } catch (err) {
      console.error("Erro geral ao carregar dashboard:", err);
      setMessage("Erro ao carregar dados da dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    loadData();
  }, [user, isLoading, router]);

  const kpiOrganizations = useMemo(() => {
    if (onboarding?.organization_count != null) return onboarding.organization_count;
    return orgs.length;
  }, [onboarding, orgs]);

  const kpiLots = useMemo(() => {
    if (onboarding?.lot_count != null) return onboarding.lot_count;
    return lots.length;
  }, [onboarding, lots]);

  const kpiEmissions = useMemo(() => {
    if (onboarding?.emission_count != null) return onboarding.emission_count;
    return credentials.length || lots.reduce((acc, lot) => acc + (lot.issued || 0), 0);
  }, [onboarding, credentials, lots]);

  if (loading) {
    return (
      <main className="container">
        <div className="card">
          <h1>Visão Geral</h1>
          <p>Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header-row">
        <div>
          <h1>Visão Geral</h1>
          <p className="muted">Bem-vindo, {user?.name || "Admin"}!</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={loadData}>
            Atualizar
          </button>
        </div>
      </div>

      {message && (
        <p className={message.includes("Erro") ? "error" : "success"}>{message}</p>
      )}

      <section className="card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <button
            type="button"
            className="card"
            style={{ textAlign: "left", cursor: "pointer", marginBottom: 0 }}
            onClick={() => router.push("/admin/organizations")}
          >
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
              {kpiOrganizations}
            </div>
            <div className="muted">Organizações</div>
          </button>

          <button
            type="button"
            className="card"
            style={{ textAlign: "left", cursor: "pointer", marginBottom: 0 }}
            onClick={() => router.push("/admin/lots")}
          >
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
              {kpiLots}
            </div>
            <div className="muted">Lotes</div>
          </button>

          <button
            type="button"
            className="card"
            style={{ textAlign: "left", cursor: "pointer", marginBottom: 0 }}
            onClick={() => router.push("/admin/emissions")}
          >
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
              {kpiEmissions}
            </div>
            <div className="muted">Emissões</div>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Ações Rápidas</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => router.push("/admin/organizations")}>
            Gerenciar Organizações
          </button>
          <button className="btn-ghost" onClick={() => router.push("/admin/lots")}>
            Gerenciar Lotes
          </button>
          <button className="btn-ghost" onClick={() => router.push("/admin/audit")}>
            Ver Auditoria
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Resumo do Sistema</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <strong>Organizações</strong>
            <div style={{ marginTop: 6 }}>{kpiOrganizations} total</div>
          </div>

          <div>
            <strong>Lotes</strong>
            <div style={{ marginTop: 6 }}>{kpiLots} total</div>
          </div>

          <div>
            <strong>Emissões</strong>
            <div style={{ marginTop: 6 }}>{kpiEmissions} total</div>
          </div>

          <div>
            <strong>Próximo passo</strong>
            <div style={{ marginTop: 6 }}>
              {onboarding?.next_step || "Sistema operacional"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
