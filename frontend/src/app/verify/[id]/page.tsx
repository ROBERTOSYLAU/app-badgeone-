"use client";

import { useEffect, useState } from "react";

type SignDoc = {
  public_id: string;
  titulo: string;
  finalidade: string;
  partes_envolvidas: string;
  descricao?: string;
  hash_documento: string;
  pdf_url?: string;
  tx_hash: string;
  token_id: number;
  network: string;
  polygonscan_url: string;
  assinado_em: string;
  status: string;
  org_nome?: string;
  org_cnpj?: string;
};

type Badge = {
  public_id: string;
  recipient_name: string;
  course_name: string;
  status: string;
  metadata_uri?: string;
  tx_hash?: string;
  token_id?: string;
  certificate_url?: string;
  issued_at?: string;
  lot_title?: string;
  org_nome?: string;
  org_cnpj?: string;
};

type PageData =
  | { tipo: "sign"; doc: SignDoc }
  | { tipo: "badge"; badge: Badge }
  | { tipo: "nao_encontrado" };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value, mono, link }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  link?: string;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
        {label}
      </span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            color: "#1A3A5C",
            fontFamily: mono ? "monospace" : undefined,
            wordBreak: "break-all",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {value} ↗
        </a>
      ) : (
        <span
          style={{
            fontSize: 13,
            color: "#0f172a",
            fontFamily: mono ? "monospace" : undefined,
            wordBreak: "break-all",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export default function VerifyPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    async function load() {
      // Tenta primeiro como documento assinado (Badge One Sign)
      try {
        const r = await fetch(
          apiUrl(`/api/v1/sign/verify/${params.id}`)
        );
        if (r.ok) {
          const doc: SignDoc = await r.json();
          setData({ tipo: "sign", doc });
          return;
        }
      } catch {}

      // Tenta como badge/credencial
      try {
        const r = await fetch(
          apiUrl(`/api/v1/credentials/verify/${params.id}`)
        );
        if (r.ok) {
          const badge: Badge = await r.json();
          setData({ tipo: "badge", badge });
          return;
        }
      } catch {}

      setData({ tipo: "nao_encontrado" });
    }
    load();
  }, [params.id]);

  if (!data) {
    return (
      <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px" }}>
        <div
          style={{
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          Verificando...
        </div>
      </main>
    );
  }

  if (data.tipo === "nao_encontrado") {
    return (
      <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "2px solid #fca5a5",
            borderRadius: 12,
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✗</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#991b1b",
              margin: "0 0 8px",
            }}
          >
            DOCUMENTO NÃO ENCONTRADO
          </h2>
          <p style={{ fontSize: 14, color: "#b91c1c", margin: 0 }}>
            Este QR Code não corresponde a nenhum documento no sistema Badge
            One.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#ef4444",
              marginTop: 12,
              fontFamily: "monospace",
            }}
          >
            ID: {params.id}
          </p>
        </div>
      </main>
    );
  }

  if (data.tipo === "sign") {
    const doc = data.doc;
    const isValid = doc.status === "complete";
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
        {/* Status */}
        <div
          style={{
            background: isValid ? "#f0fdf4" : "#fef9c3",
            border: `2px solid ${isValid ? "#86efac" : "#fcd34d"}`,
            borderRadius: 12,
            padding: "24px 28px",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {isValid ? "✓" : "⚠"}
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: isValid ? "#166534" : "#854d0e",
              margin: "0 0 6px",
            }}
          >
            {isValid ? "DOCUMENTO VÁLIDO" : "DOCUMENTO PENDENTE"}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: isValid ? "#15803d" : "#92400e",
              margin: 0,
            }}
          >
            {isValid
              ? "Este documento foi assinado digitalmente e registrado na blockchain Polygon."
              : "Este documento foi registrado mas o PDF ainda não foi anexado."}
          </p>
        </div>

        {/* Dados do documento */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 8px",
            }}
          >
            Dados do Documento
          </h3>
          <Field label="Título" value={doc.titulo} />
          <Field label="Finalidade" value={doc.finalidade} />
          <Field label="Partes envolvidas" value={doc.partes_envolvidas} />
          {doc.descricao && <Field label="Descrição" value={doc.descricao} />}
          <Field label="Data da assinatura" value={formatDate(doc.assinado_em)} />
          <Field label="Public ID" value={doc.public_id} mono />
          <Field label="Token ID" value={String(doc.token_id)} mono />
          <Field
            label="Hash SHA-256"
            value={doc.hash_documento}
            mono
          />
        </div>

        {/* Emissor */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 8px",
            }}
          >
            Emissor
          </h3>
          <Field label="Organização" value={doc.org_nome} />
          <Field label="CNPJ" value={doc.org_cnpj} />
        </div>

        {/* Blockchain */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 8px",
            }}
          >
            Blockchain
          </h3>
          <Field label="Rede" value={doc.network} />
          <Field
            label="TX Hash"
            value={doc.tx_hash}
            mono
            link={doc.polygonscan_url}
          />
        </div>

        {/* Links */}
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={doc.polygonscan_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: "block",
              background: "#7c3aed",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 0",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🔗 Ver no Polygonscan
          </a>
          {doc.pdf_url && (
            <a
              href={doc.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "block",
                background: "#1A3A5C",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 0",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              📄 Baixar PDF original
            </a>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#94a3b8",
            marginTop: 24,
          }}
        >
          Verificado por Badge One · badgeone.com.br
        </p>
      </main>
    );
  }

  // Badge / credencial
  const badge = data.badge;
  const isValid = badge.status === "valid" || badge.status === "active";
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
      <div
        style={{
          background: isValid ? "#f0fdf4" : "#fef2f2",
          border: `2px solid ${isValid ? "#86efac" : "#fca5a5"}`,
          borderRadius: 12,
          padding: "24px 28px",
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {isValid ? "✓" : "✗"}
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: isValid ? "#166534" : "#991b1b",
            margin: "0 0 6px",
          }}
        >
          {isValid ? "CREDENCIAL VÁLIDA" : "CREDENCIAL INVÁLIDA"}
        </h2>
        <p style={{ fontSize: 13, color: isValid ? "#15803d" : "#b91c1c", margin: 0 }}>
          Status: {badge.status.toUpperCase()}
        </p>
      </div>

      {/* Emissor */}
      {(badge.org_nome || badge.lot_title) && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Emissor</h3>
          <Field label="Organização" value={badge.org_nome} />
          <Field label="CNPJ" value={badge.org_cnpj} />
          {badge.lot_title && <Field label="Lote" value={badge.lot_title} />}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Credencial</h3>
        <Field label="Beneficiário" value={badge.recipient_name} />
        <Field label="Certificação" value={badge.course_name} />
        {badge.issued_at && <Field label="Data de emissão" value={formatDate(badge.issued_at)} />}
        <Field label="Public ID" value={badge.public_id} mono />
        {badge.token_id && (
          <Field label="Token ID" value={badge.token_id} mono />
        )}
        {badge.tx_hash && (
          <Field
            label="TX Hash"
            value={badge.tx_hash}
            mono
            link={`https://polygonscan.com/tx/${badge.tx_hash}`}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {badge.tx_hash && (
          <a
            href={`https://polygonscan.com/tx/${badge.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: "block",
              background: "#7c3aed",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 0",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🔗 Ver no Polygonscan
          </a>
        )}
        {badge.certificate_url && (
          <a
            href={badge.certificate_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: "block",
              background: "#1A3A5C",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 0",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            📄 Baixar certificado
          </a>
        )}
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "#94a3b8",
          marginTop: 24,
        }}
      >
        Verificado por Badge One · badgeone.com.br
      </p>
    </main>
  );
}
