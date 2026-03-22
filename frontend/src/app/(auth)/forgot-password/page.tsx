"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.reset_token) {
        setResetToken(data.reset_token);
      } else {
        // Email not found but we still show success (security)
        setResetToken("not_found");
      }
    } catch {
      setError("Erro ao processar solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const resetLink = resetToken && resetToken !== "not_found"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password?token=${resetToken}`
    : null;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>
            Recuperar acesso
          </h1>
          <p style={{ color: "#666", fontSize: 13, margin: "6px 0 0" }}>
            Informe seu e-mail para redefinir sua senha
          </p>
        </div>

        {!resetToken ? (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle}>E-mail cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={btnStyle}
            >
              {loading ? "Verificando..." : "Gerar link de redefinição"}
            </button>
          </form>
        ) : resetToken === "not_found" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "16px", fontSize: 13, color: "#166534", marginBottom: 20 }}>
              Se o e-mail estiver cadastrado, você receberá as instruções.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "16px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#1e40af", margin: "0 0 10px", fontWeight: 600 }}>
                Link de redefinição gerado!
              </p>
              <p style={{ fontSize: 12, color: "#1e40af", margin: "0 0 12px" }}>
                Copie o link abaixo e abra no navegador para definir sua nova senha. Válido por 2 horas.
              </p>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                  color: "#1e40af",
                  cursor: "pointer",
                }}
                onClick={() => navigator.clipboard.writeText(resetLink!)}
                title="Clique para copiar"
              >
                {resetLink}
              </div>
              <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 6, textAlign: "right" }}>
                Clique no link para copiar
              </p>
            </div>
            <Link
              href={resetLink!}
              style={{ display: "block", textAlign: "center", fontSize: 13, color: "#1A3A5C", fontWeight: 600, textDecoration: "none" }}
            >
              Redefinir senha agora →
            </Link>
          </div>
        )}

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
