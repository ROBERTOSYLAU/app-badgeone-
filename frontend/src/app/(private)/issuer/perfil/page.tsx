"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import { apiPut } from "../../../../lib/api";

export default function PerfilPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();

  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (newPassword && newPassword !== confirmPassword) {
      setResult({ ok: false, msg: "A nova senha e a confirmação não coincidem." });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setResult({ ok: false, msg: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }

    setLoading(true);
    try {
      await apiPut("/api/v1/auth/me", {
        email: email !== user?.email ? email : undefined,
        current_password: currentPassword,
        new_password: newPassword || undefined,
      });
      setResult({ ok: true, msg: "Dados atualizados com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshSession();
    } catch (err: any) {
      setResult({ ok: false, msg: err.message || "Erro ao atualizar. Verifique sua senha atual." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 560 }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--text-secondary, #666)", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 20 }}
      >
        ← Voltar
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 6 }}>
        Meu Perfil
      </h1>
      <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, marginBottom: 28 }}>
        Altere seu e-mail ou senha de acesso. Apenas você pode fazer isso.
      </p>

      <div
        style={{
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 10,
          padding: "24px",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={labelStyle}>E-mail de acesso</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 16 }}>
            <label style={{ ...labelStyle, marginBottom: 12, fontSize: 13, color: "var(--text-primary, #111)", fontWeight: 600 }}>
              Alterar senha (opcional)
            </label>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
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
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 16 }}>
            <label style={labelStyle}>Senha atual (obrigatória para confirmar)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#93c5fd" : "#1A3A5C",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              fontSize: 13,
              background: result.ok ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${result.ok ? "#86efac" : "#fca5a5"}`,
              color: result.ok ? "#166534" : "#991b1b",
            }}
          >
            {result.msg}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary, #555)",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--border, #d1d5db)",
  borderRadius: 7,
  fontSize: 14,
  background: "var(--card-bg, #fff)",
  color: "var(--text-primary, #111)",
  boxSizing: "border-box",
};
