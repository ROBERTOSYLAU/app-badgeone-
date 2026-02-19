"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Login inválido");
      return;
    }

    const data = await res.json();
    localStorage.setItem("badgeone_token", data.access_token);
    localStorage.setItem("badgeone_role", data.role);

    if (data.role === "admin") router.push("/admin");
    else router.push("/issuer");
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 24, border: "1px solid #2a3b73", borderRadius: 12 }}>
      <h1>Login Badge One</h1>
      <p>Entrada única para Admin e Emissor.</p>
      <p style={{ color: "#9fb0d0", fontSize: 13 }}>Dica dev: crie admin via POST /api/v1/auth/seed-admin</p>
      <form onSubmit={onSubmit}>
        <label>E-mail</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          style={{ width: "100%", padding: 12, margin: "8px 0 14px", borderRadius: 8 }}
        />
        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{ width: "100%", padding: 12, margin: "8px 0 14px", borderRadius: 8 }}
        />
        {error && <p style={{ color: "#ff8c8c" }}>{error}</p>}
        <button type="submit" style={{ width: "100%", padding: 12, borderRadius: 8, background: "#1f71d7", color: "#fff", border: 0 }}>
          Entrar
        </button>
      </form>
    </main>
  );
}
