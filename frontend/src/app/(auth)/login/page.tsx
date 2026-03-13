"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { setSession } from "../../../lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

export default function LoginPage() {
  const router = useRouter();
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
      const res = await fetch(apiUrl(`/api/v1/auth/login`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Login inválido.");
        return;
      }

      const data = await res.json();
      setSession(data);

      if (data.role === "admin") router.push("/admin");
      else router.push("/issuer");
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="centered">
      <section className="card">
        <h1>Entrar no sistema</h1>
        <p>Acesso de sessão (Admin e Emissor).</p>
        <p><a href="/">← Voltar para seleção de acesso</a></p>
        <p className="muted" style={{ fontSize: 13 }}>Dica dev: crie admin via POST /api/v1/auth/seed-admin</p>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            type="email"
            autoComplete="email"
          />

          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
