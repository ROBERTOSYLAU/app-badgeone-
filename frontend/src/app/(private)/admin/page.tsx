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

type Org = { id: number; name: string; status: string };
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
type Credential = { id: number; organization_id?: number; lot_id?: number; status?: string };

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setRefreshing(true);
    setMessage("");
    try {
      const [oRes, lRes, obRes, cRes] = await Promise.allSettled([
        apiGet("/api/v1/organizations"),
        apiGet("/api/v1/lots"),
        apiGet("/api/v1/auth/onboarding-status"),
        apiGet("/api/v1/credentials"),
      ]);
      if (oRes.status === "fulfilled") setOrgs((oRes.value as Org[]) || []);
      else setOrgs([]);
      if (lRes.status === "fulfilled") setLots((lRes.value as Lot[]) || []);
      else setLots([]);
      if (obRes.status === "fulfilled") setOnboarding((obRes.value as OnboardingStatus) || null);
      else setOnboarding(null);
      if (cRes.status === "fulfilled") setCredentials((cRes.value as Credential[]) || []);
      else setCredentials([]);
    } catch {
      setMessage("Erro ao carregar dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") { router.push("/login"); return; }
    loadData();
  }, [user, isLoading, router]);

  const kpiOrganizations = useMemo(() => onboarding?.organization_count ?? orgs.length, [onboarding, orgs]);
  const kpiLots = useMemo(() => onboarding?.lot_count ?? lots.length, [onboarding, lots]);
  const kpiEmissions = useMemo(
    () => onboarding?.emission_count ?? (credentials.length || lots.reduce((a, l) => a + (l.issued || 0), 0)),
    [onboarding, credentials, lots]
  );

  const completionRate = useMemo(() => {
    if (!onboarding) return 0;
    const steps = [onboarding.has_organization, onboarding.has_issuer_user, onboarding.has_lot, onboarding.has_emission];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [onboarding]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Carregando dashboard…</p>
        </div>
      </main>
    );
  }

  const nextStep = onboarding?.next_step;
  const nextStepLabel: Record<string, string> = {
    emit_badge: "Emitir primeiro badge",
    create_lot: "Criar um lote",
    create_issuer: "Adicionar emissor",
    create_organization: "Criar organização",
  };

  return (
    <main style={styles.page}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Visão Geral</h1>
          <p style={styles.pageSubtitle}>
            Bem-vindo, <strong>{user?.name || "Admin"}</strong> · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          style={{ ...styles.btnOutline, ...(refreshing ? styles.btnDisabled : {}) }}
          onClick={loadData}
          disabled={refreshing}
        >
          {refreshing ? (
            <span style={styles.spinnerSmall} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          )}
          Atualizar
        </button>
      </header>

      {message && (
        <div style={styles.errorBanner}>{message}</div>
      )}

      {/* ── KPI Cards ── */}
      <section style={styles.kpiGrid}>
        <KpiCard
          label="Organizações"
          value={kpiOrganizations}
          icon={<OrgIcon />}
          color="#5B2D8E"
          onClick={() => router.push("/admin/organizations")}
          hint="Ver todas"
        />
        <KpiCard
          label="Lotes"
          value={kpiLots}
          icon={<LotIcon />}
          color="#7C3ACD"
          onClick={() => router.push("/admin/lots")}
          hint="Ver todos"
        />
        <KpiCard
          label="Emissões"
          value={kpiEmissions}
          icon={<BadgeIcon />}
          color="#B5D400"
          onClick={() => router.push("/admin/emissions")}
          hint="Ver todas"
        />
        <KpiCard
          label="Setup concluído"
          value={`${completionRate}%`}
          icon={<CheckIcon />}
          color={completionRate === 100 ? "#16A34A" : "#F59E0B"}
          hint={completionRate === 100 ? "Tudo pronto!" : "Em andamento"}
        />
      </section>

      <div style={styles.twoCol}>
        {/* ── Ações Rápidas ── */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Ações Rápidas</h2>
          <div style={styles.actionGrid}>
            <ActionBtn
              label="Organizações"
              description="Gerenciar e criar"
              icon={<OrgIcon size={20} />}
              onClick={() => router.push("/admin/organizations")}
            />
            <ActionBtn
              label="Lotes"
              description="Gerenciar lotes de badges"
              icon={<LotIcon size={20} />}
              onClick={() => router.push("/admin/lots")}
            />
            <ActionBtn
              label="Emissões"
              description="Ver credenciais emitidas"
              icon={<BadgeIcon size={20} />}
              onClick={() => router.push("/admin/emissions")}
            />
            <ActionBtn
              label="Histórico"
              description="Logs de ações"
              icon={<AuditIcon size={20} />}
              onClick={() => router.push("/admin/audit")}
            />
          </div>
        </section>

        {/* ── Status do Sistema ── */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Status do Sistema</h2>

          {/* Onboarding progress */}
          <div style={styles.progressWrap}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>Configuração inicial</span>
              <span style={styles.progressValue}>{completionRate}%</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${completionRate}%`, backgroundColor: completionRate === 100 ? "#16A34A" : "#5B2D8E" }} />
            </div>
          </div>

          <div style={styles.statusList}>
            <StatusRow label="Organização criada" done={onboarding?.has_organization ?? false} />
            <StatusRow label="Emissor cadastrado" done={onboarding?.has_issuer_user ?? false} />
            <StatusRow label="Lote configurado" done={onboarding?.has_lot ?? false} />
            <StatusRow label="Badge emitido" done={onboarding?.has_emission ?? false} />
          </div>

          {nextStep && nextStep !== "completed" && (
            <div style={styles.nextStepBox}>
              <span style={styles.nextStepLabel}>Próximo passo</span>
              <span style={styles.nextStepValue}>{nextStepLabel[nextStep] || nextStep}</span>
            </div>
          )}

          {onboarding?.completed && (
            <div style={styles.completedBadge}>
              <CheckIcon size={14} color="#10B981" /> Sistema totalmente operacional
            </div>
          )}
        </section>
      </div>

      {/* ── Tabela Resumo ── */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Resumo Geral</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Métrica</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow label="Organizações" value={kpiOrganizations} active={kpiOrganizations > 0} />
            <SummaryRow label="Lotes" value={kpiLots} active={kpiLots > 0} />
            <SummaryRow label="Emissões" value={kpiEmissions} active={kpiEmissions > 0} />
            <SummaryRow label="Emissores" value={onboarding?.issuer_count ?? 0} active={(onboarding?.issuer_count ?? 0) > 0} />
          </tbody>
        </table>
      </section>
    </main>
  );
}

/* ── Sub-components ── */

function KpiCard({ label, value, icon, color, onClick, hint }: {
  label: string; value: number | string; icon: React.ReactNode;
  color: string; onClick?: () => void; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.kpiCard, cursor: onClick ? "pointer" : "default" }}
      className="kpi-card"
    >
      <div style={{ ...styles.kpiIcon, backgroundColor: `${color}14`, color }}>
        {icon}
      </div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
      {hint && <div style={styles.kpiHint}>{hint} →</div>}
      <style>{`.kpi-card:hover { border-color: ${color}50 !important; transform: translateY(-1px); box-shadow: 0 4px 14px ${color}14; }`}</style>
    </button>
  );
}

function ActionBtn({ label, description, icon, onClick }: {
  label: string; description: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={styles.actionBtn} className="action-btn">
      <div style={styles.actionIcon}>{icon}</div>
      <div>
        <div style={styles.actionLabel}>{label}</div>
        <div style={styles.actionDesc}>{description}</div>
      </div>
      <style>{`.action-btn:hover { background: rgba(91,45,142,0.04) !important; border-color: rgba(91,45,142,0.25) !important; }`}</style>
    </button>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={styles.statusRow}>
      <span style={{ ...styles.statusDot, backgroundColor: done ? "var(--success)" : "var(--line)" }} />
      <span style={{ ...styles.statusText, color: done ? "var(--text)" : "var(--muted)" }}>{label}</span>
      <span style={{ ...styles.statusBadge, backgroundColor: done ? "rgba(22,163,74,0.08)" : "var(--line)", color: done ? "var(--success)" : "var(--muted)" }}>
        {done ? "Concluído" : "Pendente"}
      </span>
    </div>
  );
}

function SummaryRow({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <tr>
      <td style={styles.td}>{label}</td>
      <td style={{ ...styles.td, fontWeight: 600, color: "var(--text)" }}>{value}</td>
      <td style={styles.td}>
        <span style={{ ...styles.pill, backgroundColor: active ? "rgba(22,163,74,0.08)" : "var(--line)", color: active ? "var(--success)" : "var(--muted)" }}>
          {active ? "Ativo" : "Vazio"}
        </span>
      </td>
    </tr>
  );
}

/* ── Icons ── */
function OrgIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function LotIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}
function BadgeIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>;
}
function AuditIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}
function CheckIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

/* ── Styles ── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "var(--bg-soft)",
    padding: "16px 20px",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "var(--text)",
  },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: 10,
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    border: "3px solid var(--line)",
    borderTop: "3px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { color: "var(--muted)", fontSize: 13 },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--primary)",
    margin: 0,
    letterSpacing: "-0.5px",
  },
  pageSubtitle: {
    fontSize: 13,
    color: "var(--muted)",
    margin: "4px 0 0",
    textTransform: "capitalize",
  },
  btnOutline: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--muted)",
    backgroundColor: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 7,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  spinnerSmall: {
    display: "inline-block",
    width: 11,
    height: 11,
    border: "2px solid var(--line)",
    borderTop: "2px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    border: "1px solid rgba(220,38,38,0.3)",
    color: "var(--danger)",
    borderRadius: 7,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 10,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "12px 14px",
    textAlign: "left",
    transition: "all 0.18s ease",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  kpiValue: { fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: "var(--muted)", fontWeight: 500 },
  kpiHint: { fontSize: 11, color: "var(--primary)", marginTop: 2 },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    margin: "0 0 12px",
    paddingBottom: 10,
    borderBottom: "1px solid var(--line)",
  },
  actionGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    backgroundColor: "transparent",
    border: "1px solid var(--line)",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "left",
    color: "inherit",
    width: "100%",
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: "rgba(91,45,142,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--primary)",
    flexShrink: 0,
  },
  actionLabel: { fontSize: 13, fontWeight: 500, color: "var(--text)" },
  actionDesc: { fontSize: 11, color: "var(--muted)", marginTop: 1 },
  progressWrap: { marginBottom: 16 },
  progressHeader: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 12, color: "var(--muted)" },
  progressValue: { fontSize: 12, fontWeight: 600, color: "var(--text)" },
  progressBar: { height: 5, backgroundColor: "var(--line)", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99, transition: "width 0.4s ease" },
  statusList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  statusRow: { display: "flex", alignItems: "center", gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  statusText: { fontSize: 13, flex: 1 },
  statusBadge: { fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 99 },
  nextStepBox: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "10px 12px",
    backgroundColor: "var(--bg-soft)",
    border: "1px solid var(--line)",
    borderLeft: "3px solid var(--primary)",
    borderRadius: 7,
  },
  nextStepLabel: { fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" },
  nextStepValue: { fontSize: 13, fontWeight: 500, color: "var(--primary)" },
  completedBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 12px",
    backgroundColor: "rgba(22,163,74,0.08)",
    border: "1px solid rgba(22,163,74,0.3)",
    borderRadius: 7,
    fontSize: 13,
    color: "var(--success)",
    fontWeight: 500,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "0 0 10px",
    textAlign: "left",
    borderBottom: "1px solid var(--line)",
  },
  td: {
    fontSize: 13,
    color: "var(--muted)",
    padding: "10px 0",
    borderBottom: "1px solid var(--line)",
  },
  pill: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 99,
  },
};
