"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

type ProfileType = "admin" | "issuer" | "winner" | "public";

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
    // Pre-fill default emails based on profile
    if (profile === "admin") {
      setEmail("admin@badgeone.com.br");
    } else if (profile === "issuer") {
      setEmail("");
    } else if (profile === "winner") {
      setEmail(""); // Winner needs to enter their email
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
    <main className="login-page">
      <div className="login-container">
        <div className="login-brand">
          <div className="logo">🏅</div>
          <h1>Badge One</h1>
          <p className="tagline">Plataforma de credenciamento digital</p>
        </div>

        <div className="login-card">
          <h2>Acesso ao Sistema</h2>
          <p className="subtitle">Escolha seu perfil de acesso</p>

          {/* Opções de acesso */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            <button 
              type="button" 
              className={selectedProfile === "admin" ? "btn-active" : "btn-ghost"} 
              style={{ textAlign: "center", padding: "10px", fontSize: 14 }}
              onClick={() => selectProfile("admin")}
            >
              👤 Admin
            </button>
            <button 
              type="button" 
              className={selectedProfile === "issuer" ? "btn-active" : "btn-ghost"} 
              style={{ textAlign: "center", padding: "10px", fontSize: 14 }}
              onClick={() => selectProfile("issuer")}
            >
              🏢 Emissor
            </button>
            <button 
              type="button" 
              className={selectedProfile === "winner" ? "btn-active" : "btn-ghost"} 
              style={{ textAlign: "center", padding: "10px", fontSize: 14 }}
              onClick={() => selectProfile("winner")}
            >
              🏆 Ganhador
            </button>
            <button 
              type="button" 
              className={selectedProfile === "public" ? "btn-active" : "btn-ghost"} 
              style={{ textAlign: "center", padding: "10px", fontSize: 14 }}
              onClick={() => selectProfile("public")}
            >
              🔍 Público
            </button>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: 45 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    padding: "4px 8px",
                    width: "auto",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-small" /> Entrando...
                </>
              ) : (
                "Entrar no sistema"
              )}
            </button>
          </form>

          <div className="login-footer">
            <Link href="/" className="btn-ghost" style={{ display: "block", textAlign: "center", marginBottom: 12 }}>
              ← Voltar para opções de acesso
            </Link>
            <p>Ambiente seguro • Acesso restrito</p>
          </div>
        </div>
      </div>
    </main>
  );
}
