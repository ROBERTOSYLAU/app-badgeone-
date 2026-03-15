"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            <Link href="/login" className="btn-active" style={{ textAlign: "center", padding: "12px" }}>
              👤 Admin
            </Link>
            <Link href="/login" className="btn-ghost" style={{ textAlign: "center", padding: "12px" }}>
              🏢 Emissor
            </Link>
            <Link href="/winner" className="btn-ghost" style={{ textAlign: "center", padding: "12px" }}>
              🏆 Ganhador
            </Link>
            <Link href="/verify/demo-credential" className="btn-ghost" style={{ textAlign: "center", padding: "12px" }}>
              🔍 Público
            </Link>
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
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
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
            <p>Ambiente seguro • Acesso restrito</p>
          </div>
        </div>
      </div>
    </main>
  );
}
