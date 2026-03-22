"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { useToast } from "../../../../lib/toast-context";

type Lot = { id: number; title?: string; organization_id: number; total_badges: number; remaining: number; status: string };

export default function EmitPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotId, setLotId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientCpf, setRecipientCpf] = useState("");
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/api/v1/lots").then((data) => {
      const myLots = data.filter(
        (l: Lot) => l.organization_id === user?.organization_id && l.status === "active" && l.remaining > 0
      );
      setLots(myLots);
    });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lotId || !recipientName.trim() || !courseName.trim()) {
      toast.error("Preencha lote, nome e certificação.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost("/api/v1/credentials/issue", {
        organization_id: user?.organization_id,
        lot_id: Number(lotId),
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim() || null,
        recipient_cpf: recipientCpf.trim() || null,
        course_name: courseName.trim(),
      });
      toast.success(`Certificação emitida com sucesso! ID: ${data.public_id}`);
      setLotId("");
      setRecipientName("");
      setRecipientEmail("");
      setRecipientCpf("");
      setCourseName("");
      // Refresh lots
      apiGet("/api/v1/lots").then((d) => {
        setLots(d.filter((l: Lot) => l.organization_id === user?.organization_id && l.status === "active" && l.remaining > 0));
      });
    } catch {
      toast.error("Erro ao emitir. Verifique o saldo do lote.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 680 }}>
      <button
        onClick={() => router.back()}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-secondary, #666)",
          cursor: "pointer",
          fontSize: 13,
          padding: 0,
          marginBottom: 20,
        }}
      >
        ← Voltar
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 6 }}>
        🎖️ Emitir Certificação
      </h1>
      <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, marginBottom: 28 }}>
        Preencha os dados do destinatário para emitir a credencial.
      </p>

      {lots.length === 0 && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            color: "#856404",
            marginBottom: 20,
          }}
        >
          Nenhum lote ativo com saldo disponível. Solicite um lote ao administrador.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={labelStyle}>Lote</label>
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            required
            style={inputStyle}
          >
            <option value="">Selecione o lote</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title || `Lote #${l.id}`} — {l.remaining} disponíveis
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Nome do destinatário *</label>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ex: Maria Silva"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>E-mail do destinatário (opcional)</label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Ex: maria@email.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>CPF do destinatário (opcional)</label>
          <input
            value={recipientCpf}
            onChange={(e) => setRecipientCpf(e.target.value)}
            placeholder="000.000.000-00"
            maxLength={14}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: "var(--text-secondary, #888)", marginTop: 3, display: "block" }}>
            Uso restrito — finalidade de rastreio conforme LGPD
          </span>
        </div>

        <div>
          <label style={labelStyle}>Certificação *</label>
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Ex: Certificado de Conclusão, Reconhecimento de Participação..."
            required
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading || lots.length === 0}
          style={{
            background: loading || lots.length === 0 ? "#93c5fd" : "#1A3A5C",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || lots.length === 0 ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Emitindo..." : "Emitir certificação"}
        </button>
      </form>

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
