"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../../lib/api";
import { useToast } from "../../../../lib/toast-context";

type LicencaStatus = {
  ativa: boolean;
  motivo?: string;
  valid_until?: string;
  dias_restantes?: number;
  tipo?: string;
  alerta?: boolean;
};

type Lot = {
  id: number;
  title?: string;
  display_title?: string;
  total_badges: number;
  issued: number;
  remaining: number;
  status: string;
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function PlanosPage() {
  const toast = useToast();
  const [licenca, setLicenca] = useState<LicencaStatus | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    try {
      const [lic, lotsData] = await Promise.all([
        apiGet("/api/v1/licenca/status"),
        apiGet("/api/v1/lots"),
      ]);
      setLicenca(lic as LicencaStatus);
      const arr = (lotsData as Lot[]).filter((l) => l.status === "active");
      setLots(arr);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);


  if (loading) {
    return (
      <div style={{ padding: "40px 32px", color: "var(--text-secondary,#666)", fontSize: 14 }}>
        Carregando...
      </div>
    );
  }

  const totalCreditos = lots.reduce((s, l) => s + l.remaining, 0);
  const licAtiva = licenca?.ativa;
  const diasAlerta = licenca?.alerta;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary,#111)", margin: "0 0 4px" }}>
        💳 Planos e Licenças
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary,#666)", margin: "0 0 28px" }}>
        Gerencie sua licença de assinatura digital e seus créditos de certificação.
      </p>

      {/* ── Licença de Assinatura ── */}
      <div style={{
        background: "var(--card-bg,#fff)",
        border: `1.5px solid ${licAtiva ? (diasAlerta ? "#fcd34d" : "#86efac") : "#fca5a5"}`,
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{licAtiva ? (diasAlerta ? "🟡" : "🟢") : "🔴"}</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary,#111)", margin: 0 }}>
                Badge One Sign — Licença Anual
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary,#555)", margin: "0 0 12px", maxWidth: 420 }}>
              Assine documentos digitalmente com registro na blockchain Polygon.
              Carimbo com dados do emissor + QR de verificação pública.
            </p>

            {licAtiva ? (
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>VÁLIDA ATÉ</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: diasAlerta ? "#92400e" : "#166534" }}>
                    {formatDate(licenca?.valid_until)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>DIAS RESTANTES</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: diasAlerta ? "#92400e" : "#166534" }}>
                    {licenca?.dias_restantes} dias
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>TIPO</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                    {licenca?.tipo === "bonus" ? "Bônus (lote)" : "Renovação paga"}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#991b1b",
              }}>
                Você não possui licença ativa. Adquira um lote de badges ou renove abaixo.
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180, alignItems: "center", justifyContent: "center" }}>
            <div style={{
              padding: "10px 16px",
              background: "rgba(26,58,92,0.06)",
              border: "1px solid rgba(26,58,92,0.15)",
              borderRadius: 8,
              fontSize: 12,
              color: "#475569",
              textAlign: "center",
            }}>
              🔒 Ativação pelo administrador
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
              R$ 50,00 / ano · assinaturas ilimitadas
            </div>
          </div>
        </div>

        {diasAlerta && licAtiva && (
          <div style={{
            marginTop: 16,
            background: "#fef9c3",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#92400e",
          }}>
            ⚠️ Sua licença vence em {licenca?.dias_restantes} dias. Entre em contato com o administrador para renovar.
          </div>
        )}
      </div>

      {/* ── Badge One Certificate — Créditos ── */}
      <div style={{
        background: "var(--card-bg,#fff)",
        border: "1px solid var(--border,#e5e7eb)",
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🎖️</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary,#111)", margin: 0 }}>
            Badge One Certificate — Créditos
          </h2>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary,#555)", margin: "0 0 16px" }}>
          Cada badge emite 1 certificado com dados do emissor + ganhador.
          Ao comprar um lote, sua licença de assinatura é renovada automaticamente por +1 ano.
        </p>

        {lots.length === 0 ? (
          <div style={{
            background: "rgba(26,58,92,0.04)",
            border: "1px dashed rgba(26,58,92,0.2)",
            borderRadius: 8,
            padding: "20px",
            textAlign: "center",
            fontSize: 13,
            color: "#64748b",
          }}>
            Nenhum lote ativo no momento.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {lots.map((lot) => (
              <div key={lot.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "12px 16px",
                background: "rgba(26,58,92,0.03)",
                border: "1px solid rgba(26,58,92,0.1)",
                borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary,#111)" }}>
                    {lot.display_title || lot.title || `Lote #${lot.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {lot.issued} emitidos de {lot.total_badges} totais
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: lot.remaining > 10 ? "#166534" : lot.remaining > 0 ? "#92400e" : "#991b1b",
                  }}>
                    {lot.remaining}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>restantes</div>
                </div>
              </div>
            ))}

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--border,#e5e7eb)",
              marginTop: 4,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary,#111)" }}>
                Total de créditos disponíveis
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#1A3A5C" }}>
                {totalCreditos} badges
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Como funciona ── */}
      <div style={{
        background: "rgba(26,58,92,0.03)",
        border: "1px solid rgba(26,58,92,0.1)",
        borderRadius: 12,
        padding: "20px 24px",
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1A3A5C", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Como funciona
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { icon: "🎖️", texto: "Compre um lote de badges → ganha +1 ano de licença de assinatura grátis" },
            { icon: "📄", texto: "Use a licença para assinar documentos ilimitadamente durante o ano" },
            { icon: "💡", texto: "Ao vencer, renove por R$ 50,00/ano e preserve seus badges para certificados" },
            { icon: "🔄", texto: "Comprar novo lote sempre renova automaticamente sua licença por mais 1 ano" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary,#555)" }}>{item.texto}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
