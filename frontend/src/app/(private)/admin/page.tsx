"use client";

import { useEffect, useState } from "react";
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

type Org = { id: number; name: string; status: string };
type Lot = { id: number; organization_id: number; title?: string; status: string; total_badges: number; issued: number };

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [o, l, ob] = await Promise.all([
        apiGet("/api/v1/organizations"),
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/auth/onboarding-status"),
      ]);
      setOrgs(o);
      setLots(l);
      setOnboarding(ob);
    } catch {
      console.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const kpiActiveOrgs = orgs.filter((o) => o.status === "active").length;
  const kpiActiveLots = lots.filter((l) => l.status === "active").length;
  const kpiIssued = lots.reduce((a, b) => a + b.issued, 0);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  const steps = [
    { key: "has_organization", label: "Criar primeira organização", path: "/admin/organizations", icon: "🏢" },
    { key: "has_issuer_user", label: "Cadastrar usuário emissor", path: "/admin/users", icon: "👤" },
    { key: "has_lot", label: "Criar primeiro lote de badges", path: "/admin/lots", icon: "📦" },
    { key: "has_emission", label: "Emitir primeira credencial", path: "/admin/emissions", icon: "🏅" },
  ];

  return (
    <div>
      <div className="header-row">
        <div>
          <h1>Visão Geral</h1>
          <p>Bem-vindo, {user?.name}!</p>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => router.push("/admin/organizations")}>
            <h3 style={{ margin: "0 0 8px", fontSize: 32, color: "var(--primary)" }}>{kpiActiveOrgs}</h3>
            <p style={{ margin: 0 }}>Organizações Ativas</p>
          </div>
          <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => router.push("/admin/lots")}>
            <h3 style={{ margin: "0 0 8px", fontSize: 32, color: "var(--success)" }}>{onboarding?.lot_count || 0}</h3>
            <p style={{ margin: 0 }}>Lotes</p>
          </div>
          <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => router.push("/admin/emissions")}>
            <h3 style={{ margin: "0 0 8px", fontSize: 32, color: "#fbbf24" }}>{kpiIssued}</h3>
            <p style={{ margin: 0 }}>Badges Emitidos</p>
          </div>
          <div className="card" style={{ margin: 0, cursor: "pointer" }} onClick={() => router.push("/admin/users")}>
            <h3 style={{ margin: "0 0 8px", fontSize: 32, color: "#a78bfa" }}>{onboarding?.issuer_count || 0}</h3>
            <p style={{ margin: 0 }}>Emissores</p>
          </div>
        </div>
      </section>

      {/* Onboarding Guide */}
      {onboarding && !onboarding.completed && (
        <section className="card">
          <h2>🚀 Complete seu setup</h2>
          <p>Siga os passos abaixo para configurar sua plataforma:</p>
          
          {steps.map((step, index) => {
            const completed = onboarding[step.key as keyof OnboardingStatus] as boolean;
            const isNext = onboarding.next_step === step.key.replace("has_", "").replace("_user", "");
            
            return (
              <div
                key={step.key}
                className={`onboarding-step ${completed ? "completed" : ""}`}
                style={{ marginTop: 12 }}
              >
                <h3>
                  <span className="step-number">{completed ? "✓" : index + 1}</span>
                  {step.icon} {step.label}
                  {completed && <span style={{ marginLeft: 8, color: "var(--success)" }}>Concluído</span>}
                  {isNext && !completed && <span style={{ marginLeft: 8, color: "var(--primary)" }}>Próximo passo →</span>}
                </h3>
                {!completed && (
                  <button onClick={() => router.push(step.path)} className="btn-ghost">
                    Ir para {step.label}
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Quick Actions */}
      <section className="card">
        <h2>Ações Rápidas</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin/organizations")}>
            🏢 Gerenciar Organizações
          </button>
          <button onClick={() => router.push("/admin/users")}>
            👤 Criar Usuário Emissor
          </button>
          <button onClick={() => router.push("/admin/lots")}>
            📦 Criar Lote
          </button>
          <button onClick={() => router.push("/admin/audit")}>
            📋 Ver Auditoria
          </button>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="card">
        <h2>Resumo do Sistema</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          <div>
            <h4 style={{ margin: "0 0 8px", color: "var(--muted)" }}>Organizações</h4>
            <p style={{ margin: 0, fontSize: 24 }}>{onboarding?.organization_count || 0} total</p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px", color: "var(--muted)" }}>Lotes</h4>
            <p style={{ margin: 0, fontSize: 24 }}>{onboarding?.lot_count || 0} total</p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px", color: "var(--muted)" }}>Emissões</h4>
            <p style={{ margin: 0, fontSize: 24 }}>{onboarding?.emission_count || 0} total</p>
          </div>
        </div>
      </section>
    </div>
  );
}
