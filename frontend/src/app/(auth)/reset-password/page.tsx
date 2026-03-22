"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Erro ao redefinir senha.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#991b1b", fontSize: 14 }}>Link inválido ou expirado.</p>
        <Link href="/forgot-password" style={{ fontSize: 13, color: "#1A3A5C" }}>
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <p style={{ fontWeight: 600, color: "#166534", fontSize: 15 }}>Senha redefinida com sucesso!</p>
        <p style={{ color: "#666", fontSize: 13 }}>Redirecionando para o login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <div>
        <label style={labelStyle}>Nova senha</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Confirmar nova senha</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repita a nova senha"
          required
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} style={btnStyle}>
        {loading ? "Salvando..." : "Definir nova senha"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>
            Nova senha
          </h1>
          <p style={{ color: "#666", fontSize: 13, margin: "6px 0 0" }}>
            Digite e confirme sua nova senha
          </p>
        </div>

        <Suspense fallback={<p style={{ textAlign: "center", color: "#666" }}>Carregando...</p>}>
          <ResetPasswordForm />
        </Suspense>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/login" style={{ fontSize: 12, color: "#666", textDecoration: "none" }}>
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f5f5f5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "32px 28px",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#555",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  fontSize: 14,
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  background: "#1A3A5C",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};
