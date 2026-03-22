"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

type ProfileType = "admin" | "issuer" | "winner" | "public";

const profiles: { id: ProfileType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "admin",
    label: "Admin",
    desc: "Gestão da plataforma",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "issuer",
    label: "Emissor",
    desc: "Emissão de badges",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: "winner",
    label: "Ganhador",
    desc: "Ver minhas credenciais",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10l1 7a5 5 0 0 1-10 0l-1-7Z" />
        <path d="M4.5 7H3a2 2 0 0 0-2 2 5 5 0 0 0 5 5" />
        <path d="M19.5 7H21a2 2 0 0 1 2 2 5 5 0 0 1-5 5" />
      </svg>
    ),
  },
  {
    id: "public",
    label: "Público",
    desc: "Verificar credencial",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectProfile(profile: ProfileType) {
    setSelectedProfile(profile);
    if (profile === "admin") {
      setEmail("admin@badgeone.com.br");
    } else if (profile === "issuer") {
      setEmail("");
    } else if (profile === "winner") {
      setEmail("");
    } else if (profile === "public") {
      router.push("/verify/demo-credential");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedProfile) {
      setError("Selecione um perfil de acesso.");
      return;
    }

    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp-root">
      {/* Orbs decorativos */}
      <div className="lp-orb lp-orb1" />
      <div className="lp-orb lp-orb2" />

      {/* Painel esquerdo — branding */}
      <aside className="lp-brand">
        <div className="lp-brand-inner">
          <div className="lp-brand-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="rgba(31,113,215,0.18)" />
              <circle cx="24" cy="24" r="16" fill="rgba(31,113,215,0.25)" />
              <path d="M24 12l3.09 6.26L34 19.27l-5 4.87 1.18 6.86L24 27.77l-6.18 3.23L19 24.14l-5-4.87 6.91-1.01L24 12z" fill="#8fc4ff" />
            </svg>
          </div>
          <h1 className="lp-brand-title">Badge One</h1>
          <p className="lp-brand-tagline">Plataforma de credenciamento digital</p>

          <ul className="lp-features">
            <li>
              <span className="lp-feat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ff0b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Emissão de badges verificáveis
            </li>
            <li>
              <span className="lp-feat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ff0b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Verificação instantânea por QR Code
            </li>
            <li>
              <span className="lp-feat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ff0b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Painel completo para emissores
            </li>
            <li>
              <span className="lp-feat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ff0b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Credenciais seguras e rastreáveis
            </li>
          </ul>

          <div className="lp-brand-footer">
            <span className="lp-lock-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            Ambiente seguro · Acesso restrito
          </div>
        </div>
      </aside>

      {/* Painel direito — formulário */}
      <main className="lp-form-panel">
        <div className="lp-form-wrap">
          {/* Logo mobile */}
          <div className="lp-mobile-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="rgba(31,113,215,0.18)" />
              <circle cx="24" cy="24" r="16" fill="rgba(31,113,215,0.25)" />
              <path d="M24 12l3.09 6.26L34 19.27l-5 4.87 1.18 6.86L24 27.77l-6.18 3.23L19 24.14l-5-4.87 6.91-1.01L24 12z" fill="#8fc4ff" />
            </svg>
            <span>Badge One</span>
          </div>

          <div className="lp-card">
            <header className="lp-card-header">
              <h2>Acesso ao Sistema</h2>
              <p>Selecione seu perfil para continuar</p>
            </header>

            {/* Seleção de perfil */}
            <div className="lp-profiles">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lp-profile-btn${selectedProfile === p.id ? " lp-profile-active" : ""}`}
                  onClick={() => selectProfile(p.id)}
                >
                  <span className="lp-profile-icon">{p.icon}</span>
                  <span className="lp-profile-label">{p.label}</span>
                  <span className="lp-profile-desc">{p.desc}</span>
                </button>
              ))}
            </div>

            {/* Formulário */}
            <form onSubmit={onSubmit} className="lp-form" noValidate>
              <div className="lp-field">
                <label htmlFor="email">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  disabled={loading}
                  className="lp-input"
                />
              </div>

              <div className="lp-field">
                <label htmlFor="password">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Senha
                </label>
                <div className="lp-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className="lp-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="lp-eye-btn"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="lp-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="lp-spinner" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Entrar no sistema
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="lp-card-footer">
              <Link href="/" className="lp-back-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Voltar para opções de acesso
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
