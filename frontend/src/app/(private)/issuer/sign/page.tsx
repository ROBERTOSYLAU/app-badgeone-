"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../../lib/auth-context";
import { useToast } from "../../../../lib/toast-context";
import { getToken } from "../../../../lib/auth";

const RENDER_SCALE = 1.5;

type BlocoPos = {
  x: number; // PDF pts from left
  y: number; // PDF pts from bottom (pdf-lib convention)
  w: number;
  h: number;
};

type DragState = {
  startMX: number;
  startMY: number;
  startBx: number; // canvas px
  startBy: number; // canvas px (top of block)
  hasMoved: boolean;
};

type DadosAssinatura = {
  titulo: string;
  finalidade: string;
  partesEnvolvidas: string;
  descricao: string;
};

type ResultadoAssinatura = {
  publicId: string;
  tokenId: number;
  txHash: string;
  polygonscanUrl: string;
  network: string;
  pdfUrl?: string;
  mintMode?: string;
};

async function sha256Hex(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ══════════════════════════════════════════════════════════════
   Formulário pré-assinatura
══════════════════════════════════════════════════════════════ */
function FormularioPreAssinatura({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (dados: DadosAssinatura) => void;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosAssinatura>({
    titulo: "",
    finalidade: "",
    partesEnvolvidas: "",
    descricao: "",
  });

  const valido =
    dados.titulo.trim() &&
    dados.finalidade &&
    dados.partesEnvolvidas.trim();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--card-bg,#fff)",
          borderRadius: 12,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary,#111)",
            margin: "0 0 6px",
          }}
        >
          Informações do documento
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary,#666)",
            margin: "0 0 20px",
          }}
        >
          Estas informações serão gravadas na blockchain e no sistema Badge One.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>Título do documento *</label>
            <input
              style={inp}
              type="text"
              placeholder="Ex: Contrato de Prestação de Serviços"
              maxLength={100}
              value={dados.titulo}
              onChange={(e) => setDados({ ...dados, titulo: e.target.value })}
            />
          </div>

          <div>
            <label style={lbl}>Finalidade *</label>
            <select
              style={inp}
              value={dados.finalidade}
              onChange={(e) =>
                setDados({ ...dados, finalidade: e.target.value })
              }
            >
              <option value="">Selecione...</option>
              <option value="contrato">Contrato</option>
              <option value="certificado">Certificado</option>
              <option value="comprovante">Comprovante</option>
              <option value="declaracao">Declaração</option>
              <option value="acordo">Acordo</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label style={lbl}>Partes envolvidas *</label>
            <input
              style={inp}
              type="text"
              placeholder="Ex: Sylau Company LTDA e João Silva CPF 000.000.000-00"
              maxLength={200}
              value={dados.partesEnvolvidas}
              onChange={(e) =>
                setDados({ ...dados, partesEnvolvidas: e.target.value })
              }
            />
          </div>

          <div>
            <label style={lbl}>Descrição</label>
            <textarea
              style={{ ...inp, resize: "vertical" }}
              placeholder="Descreva o conteúdo e contexto do documento..."
              rows={3}
              maxLength={1000}
              value={dados.descricao}
              onChange={(e) =>
                setDados({ ...dados, descricao: e.target.value })
              }
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancelar}
            style={{
              padding: "9px 18px",
              borderRadius: 7,
              fontSize: 13,
              cursor: "pointer",
              background: "var(--bg-soft,#f9fafb)",
              border: "1px solid var(--border,#d1d5db)",
              color: "var(--text-primary,#111)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => valido && onConfirmar(dados)}
            disabled={!valido}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 700,
              cursor: valido ? "pointer" : "not-allowed",
              background: valido ? "#1A3A5C" : "#e5e7eb",
              color: valido ? "#fff" : "#9ca3af",
              border: "none",
            }}
          >
            Assinar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Tela de sucesso
══════════════════════════════════════════════════════════════ */
function TelaResultado({
  resultado,
  onNovo,
}: {
  resultado: ResultadoAssinatura;
  onNovo: () => void;
}) {
  const isMock = resultado.mintMode === "mock_fallback";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 600 }}>
      <div
        style={{
          background: "#d1fae5",
          border: "1px solid #6ee7b7",
          borderRadius: 12,
          padding: "24px 28px",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#065f46",
            margin: "0 0 6px",
          }}
        >
          Documento assinado com sucesso!
        </h2>
        <p style={{ fontSize: 13, color: "#047857", margin: 0 }}>
          O documento foi registrado na blockchain Polygon e salvo no sistema.
        </p>
        {isMock && (
          <p
            style={{
              fontSize: 11,
              color: "#b45309",
              marginTop: 8,
              background: "#fef3c7",
              borderRadius: 6,
              padding: "4px 10px",
              display: "inline-block",
            }}
          >
            ⚠️ Modo simulado — RPC indisponível no momento
          </p>
        )}
      </div>

      <div
        style={{
          background: "var(--card-bg,#fff)",
          border: "1px solid var(--border,#e5e7eb)",
          borderRadius: 10,
          padding: "20px 24px",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <InfoRow label="Public ID" value={resultado.publicId} mono />
          <InfoRow label="Token ID" value={String(resultado.tokenId)} mono />
          <InfoRow label="TX Hash" value={resultado.txHash} mono />
          <InfoRow label="Rede" value={resultado.network} />
          {resultado.pdfUrl && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span
                style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }}
              >
                PDF no R2
              </span>
              <a
                href={resultado.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "#1A3A5C",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                Baixar PDF ↗
              </a>
            </div>
          )}
        </div>

        <a
          href={resultado.polygonscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginTop: 16,
            background: "#7c3aed",
            color: "#fff",
            borderRadius: 7,
            padding: "10px 0",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          🔗 Ver no Polygonscan
        </a>

        <a
          href={`/verify/${resultado.publicId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginTop: 8,
            background: "none",
            color: "#1A3A5C",
            borderRadius: 7,
            padding: "8px 0",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            border: "1px solid #bfdbfe",
          }}
        >
          🔍 Página de verificação pública
        </a>
      </div>

      <button
        onClick={onNovo}
        style={{
          display: "block",
          width: "100%",
          marginTop: 14,
          padding: "10px",
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          background: "#1A3A5C",
          color: "#fff",
          border: "none",
        }}
      >
        + Assinar outro documento
      </button>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-primary,#111)",
          fontFamily: mono ? "monospace" : undefined,
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Página principal
══════════════════════════════════════════════════════════════ */
export default function IssuerSignPage() {
  const { user } = useAuth();
  const toast = useToast();

  const rawBytesRef = useRef<Uint8Array | null>(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [, forceRender] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  const [blocoPos, setBlocoPos] = useState<BlocoPos | null>(null);
  const blocoRef = useRef<BlocoPos | null>(null);
  blocoRef.current = blocoPos;

  const [blocoSize, setBlocoSize] = useState({ w: 280, h: 80 });
  const blocoSizeRef = useRef({ w: 280, h: 80 });
  blocoSizeRef.current = blocoSize;

  const isResizing = useRef(false);
  const startData = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  const draggingRef = useRef<DragState | null>(null);
  const [signing, setSigning] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAssinatura | null>(null);

  /* ── Load pdfjs from CDN ─────────────────────────────────────── */
  useEffect(() => {
    if ((window as any).pdfjsLib) return;
    const s = document.createElement("script");
    s.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(s);
  }, []);

  /* ── Render a page ───────────────────────────────────────────── */
  const renderPage = useCallback(async (pdfDoc: any, pageNum: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const vp1 = page.getViewport({ scale: 1 });
    pageSizeRef.current = { w: vp1.width, h: vp1.height };
    const vp = page.getViewport({ scale: RENDER_SCALE });
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    forceRender((n) => n + 1);
  }, []);

  /* ── Load PDF ────────────────────────────────────────────────── */
  const loadPdf = useCallback(
    async (bytes: Uint8Array) => {
      const lib = (window as any).pdfjsLib;
      if (!lib) {
        toast.error("Visualizador PDF ainda carregando, tente novamente");
        return;
      }
      setPageCount(0);
      setCurrentPage(1);
      const copy = bytes.slice();
      const doc = await lib.getDocument({ data: copy }).promise;
      pdfDocRef.current = doc;
      setPageCount(doc.numPages);
      setCurrentPage(1);
      setBlocoPos(null);
      setHasPdf(true);
      await renderPage(doc, 1);
    },
    [renderPage, toast]
  );

  /* ── Re-render on page change ────────────────────────────────── */
  useEffect(() => {
    if (pdfDocRef.current && hasPdf) {
      renderPage(pdfDocRef.current, currentPage);
    }
  }, [currentPage, hasPdf, renderPage]);

  /* ── File input ──────────────────────────────────────────────── */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bytes = new Uint8Array(ev.target!.result as ArrayBuffer);
      rawBytesRef.current = bytes;
      setResultado(null);
      let tries = 0;
      const attempt = () => {
        tries++;
        if ((window as any).pdfjsLib) {
          loadPdf(bytes);
        } else if (tries < 30) {
          setTimeout(attempt, 100);
        } else {
          toast.error("Não foi possível carregar o visualizador PDF");
        }
      };
      attempt();
    };
    reader.readAsArrayBuffer(file);
  }

  /* ── Canvas click → place bloco (only on first click) ──────── */
  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (draggingRef.current?.hasMoved) {
      draggingRef.current = null;
      return;
    }
    draggingRef.current = null;
    if (blocoPos) return;
    const ps = pageSizeRef.current;
    if (!ps) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const bW_pdf = blocoSizeRef.current.w / RENDER_SCALE;
    const bH_pdf = blocoSizeRef.current.h / RENDER_SCALE;
    const px = cx / RENDER_SCALE;
    const pdfY = ps.h - cy / RENDER_SCALE - bH_pdf;
    const clampX = Math.max(0, Math.min(px - bW_pdf / 2, ps.w - bW_pdf));
    const clampY = Math.max(0, Math.min(pdfY, ps.h - bH_pdf));
    setBlocoPos({ x: clampX, y: clampY, w: bW_pdf, h: bH_pdf });
  }

  /* ── Drag bloco ──────────────────────────────────────────────── */
  function onBlocoMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    const bp = blocoRef.current;
    const ps = pageSizeRef.current;
    if (!bp || !ps) return;
    const bH_pdf = blocoSizeRef.current.h / RENDER_SCALE;
    const canvasTop = (ps.h - bp.y - bH_pdf) * RENDER_SCALE;
    draggingRef.current = {
      startMX: e.clientX,
      startMY: e.clientY,
      startBx: bp.x * RENDER_SCALE,
      startBy: canvasTop,
      hasMoved: false,
    };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (isResizing.current) return;
      const d = draggingRef.current;
      const ps = pageSizeRef.current;
      if (!d || !ps) return;
      const dx = e.clientX - d.startMX;
      const dy = e.clientY - d.startMY;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.hasMoved = true;
      if (!d.hasMoved) return;
      const bW = blocoSizeRef.current.w / RENDER_SCALE;
      const bH = blocoSizeRef.current.h / RENDER_SCALE;
      const newCx = d.startBx + dx;
      const newCy = d.startBy + dy;
      const pdfX = Math.max(0, Math.min(newCx / RENDER_SCALE, ps.w - bW));
      const pdfY = Math.max(
        0,
        Math.min(ps.h - newCy / RENDER_SCALE - bH, ps.h - bH)
      );
      setBlocoPos((prev) => (prev ? { ...prev, x: pdfX, y: pdfY } : prev));
    }
    function onMouseUp() {
      if (draggingRef.current && !draggingRef.current.hasMoved) {
        draggingRef.current = null;
      }
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  /* ── Bloco canvas rect ───────────────────────────────────────── */
  function getBlocoRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null {
    const bp = blocoPos;
    const ps = pageSizeRef.current;
    if (!bp || !ps) return null;
    const bH_pdf = blocoSize.h / RENDER_SCALE;
    return {
      left: bp.x * RENDER_SCALE,
      top: (ps.h - bp.y - bH_pdf) * RENDER_SCALE,
      width: blocoSize.w,
      height: blocoSize.h,
    };
  }

  /* ── Abrir formulário ────────────────────────────────────────── */
  function handleSign() {
    if (!rawBytesRef.current || !blocoPos || !pageSizeRef.current) {
      toast.error("Faça upload de um PDF e posicione o bloco de assinatura");
      return;
    }
    setFormOpen(true);
  }

  /* ── Confirmar assinatura completa ───────────────────────────── */
  async function handleConfirmar(dados: DadosAssinatura) {
    const bytes = rawBytesRef.current;
    const bp = blocoPos;
    const ps = pageSizeRef.current;
    if (!bytes || !bp || !ps) return;

    setFormOpen(false);
    setSigning(true);

    try {
      // 1. SHA-256 do PDF original
      const pdfHash = await sha256Hex(bytes);

      // 2. Registrar na blockchain via backend
      const token = getToken();
      const prepareRes = await fetch("/api/v1/sign/prepare", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pdf_hash: pdfHash,
          titulo: dados.titulo,
          finalidade: dados.finalidade,
          partes_envolvidas: dados.partesEnvolvidas,
          descricao: dados.descricao,
        }),
      });

      if (!prepareRes.ok) {
        const err = await prepareRes.json();
        throw new Error(err.detail || "Erro ao registrar na blockchain");
      }
      const prepareData = await prepareRes.json();
      const {
        public_id,
        token_id,
        tx_hash,
        polygonscan_url,
        network,
        mint_mode,
      } = prepareData;

      // 3. Renderizar carimbo no PDF — Modelo B Sign (2 colunas: ASSINANTE | QR quadrado)
      const pdfLib = await import("pdf-lib");
      const { PDFDocument, rgb, StandardFonts } = pdfLib;

      const pdfDoc = await PDFDocument.load(bytes.slice());
      const pages = pdfDoc.getPages();
      const targetPage = pages[currentPage - 1];

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const now = new Date();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
      const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const orgNome = user?.organization_name || "Organização";
      const orgCnpj = (user as any)?.organization_cnpj || "";

      const { x, y } = bp;
      const w = blocoSize.w / RENDER_SCALE;
      const h = blocoSize.h / RENDER_SCALE;

      const pad = 7;
      const lineH = 8.5;
      // QR ocupa coluna quadrada = altura do bloco inteira (menos padding)
      const qrSize = h - pad * 2;
      const qrColW = qrSize + pad * 2;      // largura da coluna QR
      const textColW = w - qrColW;          // largura da coluna ASSINANTE
      const qrX = x + w - qrSize - pad;
      const sepX = x + textColW;

      // Fundo branco + borda
      targetPage.drawRectangle({
        x, y, width: w, height: h,
        borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1.5,
        color: rgb(1, 1, 1),
      });

      // Separador entre ASSINANTE e QR
      targetPage.drawLine({
        start: { x: sepX, y: y + pad },
        end: { x: sepX, y: y + h - pad },
        color: rgb(0.8, 0.8, 0.8), thickness: 0.4,
      });

      const topY = y + h - pad - 7;

      // ── Col 1: ASSINANTE ──
      const c1 = x + pad;
      targetPage.drawText("Assinado digitalmente por", { x: c1, y: topY, size: 5.5, font, color: rgb(0.55, 0.55, 0.55) });
      let y1 = topY - lineH;
      targetPage.drawText(orgNome, { x: c1, y: y1, size: 9, font: fontBold, color: rgb(0, 0, 0) });
      y1 -= lineH;
      if (orgCnpj) {
        targetPage.drawText(`CNPJ: ${orgCnpj}`, { x: c1, y: y1, size: 6.5, font, color: rgb(0.2, 0.2, 0.2) });
        y1 -= lineH;
      }
      targetPage.drawText(`Data: ${dateStr} ${timeStr}`, { x: c1, y: y1, size: 6.5, font, color: rgb(0.2, 0.2, 0.2) });
      y1 -= lineH;
      targetPage.drawText(`Public ID: ${public_id}`, { x: c1, y: y1, size: 6, font, color: rgb(0.3, 0.3, 0.3) });
      y1 -= lineH;
      targetPage.drawText(`Token ID: ${token_id}`, { x: c1, y: y1, size: 6, font, color: rgb(0.3, 0.3, 0.3) });

      // ── Col 2: QR Code quadrado → página de verificação ──
      const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${public_id}`;
      const QRCode = await import("qrcode");
      const qrDataUrl: string = await (QRCode as any).default.toDataURL(
        verifyUrl, { width: 128, margin: 1 }
      );
      const qrBase64 = qrDataUrl.split(",")[1];
      const qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0));
      const qrImage = await pdfDoc.embedPng(qrBytes);
      const qrY = y + pad;
      targetPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      // 4. Salvar PDF assinado
      const outBytes = await pdfDoc.save();

      // 5. Upload para R2 via backend
      const formData = new FormData();
      formData.append("public_id", public_id);
      formData.append(
        "pdf",
        new Blob([outBytes], { type: "application/pdf" }),
        `${public_id}.pdf`
      );

      const uploadRes = await fetch("/api/v1/sign/upload", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      let pdfUrl: string | undefined;
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        pdfUrl = uploadData.pdf_url;
      } else {
        console.warn("Upload R2 falhou — PDF só disponível localmente");
      }

      // 6. Download local do PDF assinado
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "_assinado.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 7. Exibir tela de sucesso
      setResultado({
        publicId: public_id,
        tokenId: token_id,
        txHash: tx_hash,
        polygonscanUrl:
          polygonscan_url ||
          `https://polygonscan.com/tx/${tx_hash}`,
        network: network || "polygon",
        pdfUrl,
        mintMode: mint_mode,
      });
    } catch (err: any) {
      console.error("Erro ao assinar:", err);
      toast.error(err?.message || "Erro ao assinar documento");
    } finally {
      setSigning(false);
    }
  }

  /* ── Reiniciar ───────────────────────────────────────────────── */
  function resetar() {
    setResultado(null);
    setHasPdf(false);
    setBlocoPos(null);
    setBlocoSize({ w: 280, h: 80 });
    rawBytesRef.current = null;
    pdfDocRef.current = null;
    setFileName("");
    setPageCount(0);
    setCurrentPage(1);
  }

  /* ── Resultado ───────────────────────────────────────────────── */
  if (resultado) {
    return <TelaResultado resultado={resultado} onNovo={resetar} />;
  }

  const bRect = getBlocoRect();
  const orgNome = user?.organization_name || "Organização";
  const orgCnpj = (user as any)?.organization_cnpj || "";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960 }}>
      {/* Form modal */}
      {formOpen && (
        <FormularioPreAssinatura
          onConfirmar={handleConfirmar}
          onCancelar={() => setFormOpen(false)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary,#111)",
            margin: 0,
          }}
        >
          ✍️ Assinar Documento
        </h1>
        <p
          style={{
            color: "var(--text-secondary,#666)",
            fontSize: 13,
            margin: "4px 0 0",
          }}
        >
          Faça upload de um PDF, clique para posicionar o bloco e assine com
          registro na blockchain Polygon.
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            background: "#1A3A5C",
            color: "#fff",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          📂 Escolher PDF
          <input
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        </label>

        {fileName && (
          <span
            style={{
              fontSize: 13,
              color: "var(--text-secondary,#666)",
              maxWidth: 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </span>
        )}

        {pageCount > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginLeft: "auto",
            }}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: "none",
                border: "1px solid #d1d5db",
                borderRadius: 5,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ‹
            </button>
            <span
              style={{ fontSize: 12, color: "var(--text-secondary,#666)" }}
            >
              {currentPage} / {pageCount}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(pageCount, p + 1))
              }
              disabled={currentPage === pageCount}
              style={{
                background: "none",
                border: "1px solid #d1d5db",
                borderRadius: 5,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Org info hint */}
      {hasPdf && (
        <div
          style={{
            background: "rgba(26,58,92,0.05)",
            border: "1px solid rgba(26,58,92,0.15)",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 12,
            fontSize: 12,
            color: "var(--text-secondary,#555)",
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span>
            📋 <strong>{orgNome}</strong>
            {orgCnpj ? ` · CNPJ: ${orgCnpj}` : ""}
          </span>
          <span style={{ color: "#9ca3af", marginLeft: "auto" }}>
            {blocoPos
              ? "Arraste para reposicionar · Redimensione pelo canto inferior direito"
              : "Clique no documento para posicionar o bloco de assinatura"}
          </span>
        </div>
      )}

      {/* Canvas area */}
      {hasPdf ? (
        <div
          style={{
            position: "relative",
            display: "inline-block",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          <canvas ref={canvasRef} style={{ display: "block" }} />

          <div
            onClick={onOverlayClick}
            style={{
              position: "absolute",
              inset: 0,
              cursor: blocoPos ? "default" : "crosshair",
            }}
          >
            {bRect && (
              <>
                <div
                  onMouseDown={onBlocoMouseDown}
                  style={{
                    position: "absolute",
                    left: bRect.left,
                    top: bRect.top,
                    width: bRect.width,
                    height: bRect.height,
                    cursor: "move",
                    border: "1.5px solid #333",
                    borderRadius: 3,
                    background: "white",
                    fontFamily: "Arial, sans-serif",
                    userSelect: "none",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    boxShadow: "0 1px 6px rgba(26,58,92,0.18)",
                  }}
                >
                  {/* × remove */}
                  <span
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlocoPos(null);
                      setBlocoSize({ w: 280, h: 80 });
                    }}
                    title="Remover bloco"
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      zIndex: 10,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontWeight: 700,
                      border: "1.5px solid #fff",
                    }}
                  >
                    ×
                  </span>

                  {/* ↘ SE resize handle */}
                  <div
                    title="Redimensionar"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      isResizing.current = true;
                      startData.current = {
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        w: blocoSizeRef.current.w,
                        h: blocoSizeRef.current.h,
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!isResizing.current) return;
                      const dx = e.clientX - startData.current.mouseX;
                      const dy = e.clientY - startData.current.mouseY;
                      setBlocoSize({
                        w: Math.max(200, startData.current.w + dx),
                        h: Math.max(60, startData.current.h + dy),
                      });
                    }}
                    onPointerUp={() => {
                      isResizing.current = false;
                    }}
                    style={{
                      position: "absolute",
                      bottom: -6,
                      right: -6,
                      zIndex: 20,
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: "#ef4444",
                      cursor: "se-resize",
                      touchAction: "none",
                    }}
                  />

                  {/* Preview do carimbo Sign — 2 colunas: ASSINANTE | QR quadrado */}
                  <div style={{ display: "flex", height: "100%", padding: "4px 5px", pointerEvents: "none", gap: 0, boxSizing: "border-box" }}>
                    {/* Col 1: ASSINANTE */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, paddingRight: 4, borderRight: "0.5px solid rgba(26,58,92,0.2)", overflow: "hidden", minWidth: 0 }}>
                      <div style={{ fontSize: 5, color: "#999", fontWeight: 600, letterSpacing: "0.04em" }}>Assinado digitalmente por</div>
                      <div style={{ fontSize: 7.5, fontWeight: 700, color: "#1A3A5C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orgNome}</div>
                      {orgCnpj && <div style={{ fontSize: 6, color: "#444" }}>CNPJ: {orgCnpj}</div>}
                      <div style={{ fontSize: 6, color: "#444" }}>Data: {new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div style={{ fontSize: 5.5, color: "#888" }}>Public ID: (ao assinar)</div>
                      <div style={{ fontSize: 5.5, color: "#888" }}>Token ID: (ao assinar)</div>
                    </div>

                    {/* Col 2: QR placeholder quadrado (ocupa a altura inteira do bloco) */}
                    <div style={{ aspectRatio: "1/1", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingLeft: 5, flexShrink: 0 }}>
                      <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(26,58,92,0.06)", border: "0.5px solid rgba(26,58,92,0.25)", borderRadius: 2, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "1px", padding: 3 }}>
                        {[1,0,1,0,1,0,1,0,1,0,1,1,0,0,1,0,0,1,1,0,1,0,0,1,1].map((v, i) => (
                          <div key={i} style={{ background: v ? "rgba(26,58,92,0.45)" : "transparent", borderRadius: "0.5px" }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botão assinar abaixo do bloco */}
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!signing) handleSign();
                  }}
                  style={{
                    position: "absolute",
                    left: bRect.left + bRect.width / 2,
                    top: bRect.top + bRect.height + 8,
                    transform: "translateX(-50%)",
                    background: signing ? "#475569" : "#1A3A5C",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "5px 14px",
                    borderRadius: 20,
                    cursor: signing ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(26,58,92,0.35)",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    zIndex: 20,
                    border: "1.5px solid rgba(255,255,255,0.25)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {signing ? "⏳ Registrando na blockchain..." : "✍ Pré-assinar"}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "2px dashed #d1d5db",
            borderRadius: 10,
            padding: "60px 40px",
            textAlign: "center",
            color: "var(--text-secondary,#888)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <p
            style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}
          >
            Nenhum documento carregado
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            Clique em "Escolher PDF" para começar
          </p>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary,#555)",
  marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border,#d1d5db)",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--card-bg,#fff)",
  color: "var(--text-primary,#111)",
};
