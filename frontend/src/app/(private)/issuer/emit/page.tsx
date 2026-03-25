"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { useToast } from "../../../../lib/toast-context";
import { getToken } from "../../../../lib/auth";

type Lot = {
  id: number;
  title?: string;
  display_title?: string;
  original_title?: string;
  organization_id: number;
  total_badges: number;
  remaining: number;
  status: string;
  tem_documento?: boolean;
  imagem_url?: string | null;
};

type Ganhador = {
  id: number;
  tipo: "PF" | "PJ";
  display_name: string;
  cpf_cnpj?: string;
  email?: string;
  ativo: boolean;
};

type GanhadorRow = { nome: string; cpf: string; email: string; ganhadorId: number | null };

type Emissao = {
  id: number;
  public_id: string;
  tx_hash?: string;
  token_id?: string;
  recipient_name: string;
  course_name: string;
  lot_id: number;
  ganhador_id?: number;
};

function lotName(l: Lot) {
  return l.display_title || l.title || l.original_title || `Lote #${l.id}`;
}

export default function EmitPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lots, setLots] = useState<Lot[]>([]);
  const [ganhadores, setGanhadores] = useState<Ganhador[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [lotId, setLotId] = useState<number | null>(null);
  const [ganhadorId, setGanhadorId] = useState<number | null>(null);
  const [ganhadorSearch, setGanhadorSearch] = useState("");
  const [courseName, setCourseName] = useState("");

  const [emitting, setEmitting] = useState(false);
  const [resultado, setResultado] = useState<Emissao | null>(null);

  // Emissão em lote
  const [modoLote, setModoLote] = useState(false);
  const [loteRows, setLoteRows] = useState<GanhadorRow[]>([{ nome: "", cpf: "", email: "", ganhadorId: null }]);
  const [resultadosLote, setResultadosLote] = useState<Emissao[]>([]);
  const [emitindoLote, setEmitindoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState(0);

  // Inline novo ganhador
  const [showNovoGanhador, setShowNovoGanhador] = useState(false);
  const [novoTipo, setNovoTipo] = useState<"PF" | "PJ">("PF");
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoRazao, setNovoRazao] = useState("");
  const [novoCnpj, setNovoCnpj] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoGanhador, setSalvandoGanhador] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingData(true);
      try {
        const lotsData = await apiGet("/api/v1/lots");
        const myLots = (lotsData as Lot[]).filter(
          (l) => l.status === "active" && l.remaining > 0
        );
        setLots(myLots);
      } catch (e) {
        console.error("Erro ao carregar lotes:", e);
        toast.error("Erro ao carregar lotes.");
      }
      try {
        const ganhData = await apiGet("/api/v1/ganhadores");
        setGanhadores((ganhData as Ganhador[]).filter((g) => g.ativo));
      } catch (e) {
        console.error("Erro ao carregar ganhadores:", e);
      }
      setLoadingData(false);
    };
    if (user) fetchAll();
  }, [user]);

  const selectedLot = lots.find((l) => l.id === lotId);
  const selectedGanhador = ganhadores.find((g) => g.id === ganhadorId);

  const filteredGanhadores = ganhadores.filter((g) => {
    if (!ganhadorSearch) return true;
    const s = ganhadorSearch.toLowerCase();
    return (
      g.display_name.toLowerCase().includes(s) ||
      (g.cpf_cnpj || "").replace(/\D/g, "").includes(s.replace(/\D/g, "")) ||
      (g.email || "").toLowerCase().includes(s)
    );
  });

  async function salvarNovoGanhador() {
    if (novoTipo === "PF" && !novoNome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (novoTipo === "PJ" && !novoRazao.trim()) { toast.error("Razão social é obrigatória."); return; }
    setSalvandoGanhador(true);
    try {
      const res = await fetch("/api/v1/ganhadores", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: novoTipo,
          nome: novoTipo === "PF" ? novoNome.trim() : undefined,
          cpf: novoCpf.trim() || undefined,
          razao_social: novoTipo === "PJ" ? novoRazao.trim() : undefined,
          cnpj: novoCnpj.trim() || undefined,
          email: novoEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Erro");
      const g = await res.json();
      setGanhadores((prev) => [g, ...prev]);
      setGanhadorId(g.id);
      setShowNovoGanhador(false);
      setNovoNome(""); setNovoCpf(""); setNovoRazao(""); setNovoCnpj(""); setNovoEmail("");
      toast.success("Ganhador cadastrado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar.");
    } finally {
      setSalvandoGanhador(false);
    }
  }

  async function emitir() {
    if (!lotId || !ganhadorId) { toast.error("Selecione lote e ganhador."); return; }
    setEmitting(true);
    try {
      const data = await apiPost("/api/v1/credentials/issue", {
        organization_id: user?.organization_id,
        lot_id: lotId,
        ganhador_id: ganhadorId,
        course_name: courseName.trim() || "Certificado Badge One",
      });
      setResultado({ ...data, lot_id: lotId, ganhador_id: ganhadorId });
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Erro ao emitir. Verifique o saldo do lote.");
    } finally {
      setEmitting(false);
    }
  }

  function resetForm() {
    setStep(1); setLotId(null); setGanhadorId(null);
    setGanhadorSearch(""); setCourseName(""); setResultado(null);
    setModoLote(false); setLoteRows([{ nome: "", cpf: "", email: "", ganhadorId: null }]);
    setResultadosLote([]); setProgressoLote(0);
  }

  function updateRow(idx: number, field: "nome" | "cpf" | "email", value: string) {
    setLoteRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addRow() {
    if (!selectedLot || loteRows.length >= selectedLot.remaining) return;
    setLoteRows(prev => [...prev, { nome: "", cpf: "", email: "", ganhadorId: null }]);
  }

  function removeRow(idx: number) {
    if (loteRows.length <= 1) return;
    setLoteRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function emitirLote() {
    if (!lotId) { toast.error("Selecione um lote."); return; }
    const validos = loteRows.filter(r => r.ganhadorId || r.nome.trim());
    if (validos.length === 0) { toast.error("Preencha pelo menos um ganhador."); return; }
    setEmitindoLote(true);
    setProgressoLote(0);
    const resultados: Emissao[] = [];
    for (let i = 0; i < validos.length; i++) {
      const row = validos[i];
      try {
        const payload: Record<string, unknown> = {
          organization_id: user?.organization_id,
          lot_id: lotId,
          course_name: courseName.trim() || "Certificado Badge One",
        };
        if (row.ganhadorId) {
          payload.ganhador_id = row.ganhadorId;
        } else {
          payload.recipient_name = row.nome.trim();
          payload.recipient_email = row.email.trim() || undefined;
          payload.recipient_cpf = row.cpf.trim() || undefined;
        }
        const data = await apiPost("/api/v1/credentials/issue", payload);
        resultados.push({ ...data, lot_id: lotId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro";
        toast.error(`Badge ${i + 1}: ${msg}`);
      }
      setProgressoLote(i + 1);
    }
    setResultadosLote(resultados);
    setEmitindoLote(false);
    if (resultados.length > 0) setStep(3);
  }

  async function gerarPDF(emissao: Emissao, ganhador?: Ganhador) {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const QRCode = await import("qrcode");

    const lot = lots.find(l => l.id === emissao.lot_id) || selectedLot;
    const nomeGanhador = ganhador?.display_name || emissao.recipient_name || "";
    const cpfCnpj = ganhador?.cpf_cnpj || "";
    const dataISO = new Date().toISOString().slice(0, 19).replace("T", " ") + "-03:00";
    const dataEmissao = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    const verifyUrl = `${window.location.origin}/verify/${emissao.public_id}`;

    const vars: Record<string, string> = {
      ganhador_nome: nomeGanhador,
      ganhador_cpf: cpfCnpj,
      lote_nome: lot ? lotName(lot) : "",
      org_nome: user?.organization_name || "",
      org_cnpj: (user as any)?.organization_cnpj || "",
      badge_id: emissao.public_id,
      data_emissao: dataEmissao,
      tx_hash: emissao.tx_hash || "",
      contrato_endereco: "0x784d59aCe08F825Bf3e6bAbF659e60D58B51092b",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdfDoc: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let page: any;

    // Caminho 1: lote tem imagem de fundo (art do certificado)
    if (lot?.imagem_url) {
      pdfDoc = await PDFDocument.create();
      const imgRes = await fetch(lot.imagem_url);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get("content-type") || "";
      const bgImg = contentType.includes("png")
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);
      const { width: imgW, height: imgH } = bgImg;
      page = pdfDoc.addPage([imgW, imgH]);
      page.drawImage(bgImg, { x: 0, y: 0, width: imgW, height: imgH });

      // Sem campos_config configurado — usa bloco_assinatura padrão na parte inferior
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const blocoH = 90;
      const blocoW = Math.min(imgW - 40, 520);
      const blocoX = (imgW - blocoW) / 2;
      const blocoY = 30;
      await renderBlocoAssinatura(pdfDoc, page, { x: blocoX, y: blocoY, width: blocoW, height: blocoH }, {
        nomeGanhador, cpfCnpj, dataISO,
        tokenId: emissao.token_id || emissao.public_id.slice(0, 8),
        badgeId: emissao.public_id,
        txHash: emissao.tx_hash || "",
        font, fontBold,
        loteNome: vars.lote_nome, orgNome: vars.org_nome, orgCnpj: vars.org_cnpj,
        verifyUrl,
      });
    } else {
      // Caminho 2: lote tem template PDF + campos_config
      const config = await apiGet(`/api/v1/lote-documento/${emissao.lot_id}`);
      if (!config.tem_documento) throw new Error("Lote sem modelo de documento.");
      const pdfRes = await fetch(`/api/v1/lote-documento/${emissao.lot_id}/arquivo`, { credentials: "include" });
      if (!pdfRes.ok) throw new Error("Erro ao baixar template");
      pdfDoc = await PDFDocument.load(await pdfRes.arrayBuffer());
      page = pdfDoc.getPages()[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const campos = config.campos_config as Record<string, { x: number; y: number; size?: number; width?: number; height?: number }>;
      for (const [key, pos] of Object.entries(campos)) {
        if (key === "bloco_assinatura") {
          await renderBlocoAssinatura(pdfDoc, page, pos, {
            nomeGanhador, cpfCnpj, dataISO,
            tokenId: emissao.token_id || emissao.public_id.slice(0, 8),
            badgeId: emissao.public_id,
            txHash: emissao.tx_hash || "",
            font, fontBold,
            loteNome: vars.lote_nome, orgNome: vars.org_nome, orgCnpj: vars.org_cnpj,
            verifyUrl,
          });
        } else if (key === "qr_code") {
          const qrDataUrl = await QRCode.default.toDataURL(verifyUrl, { width: 256, margin: 1 });
          const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
          const qrImg = await pdfDoc.embedPng(qrBytes);
          page.drawImage(qrImg, { x: pos.x, y: pos.y, width: pos.width || 80, height: pos.height || 80 });
        } else if (vars[key]) {
          page.drawText(vars[key], { x: pos.x, y: pos.y, size: pos.size || 12, font, color: rgb(0, 0, 0) });
        }
      }
    }

    return pdfDoc.save();
  }

  async function downloadCertificado() {
    if (!resultado || !lotId) return;
    const lot = selectedLot;
    if (!lot?.tem_documento && !lot?.imagem_url) { toast.error("Lote sem modelo de documento."); return; }
    try {
      const outBytes = await gerarPDF(resultado, selectedGanhador || undefined);
      // Upload para R2
      try {
        const token = getToken();
        const fd = new FormData();
        fd.append("pdf", new Blob([outBytes], { type: "application/pdf" }), `${resultado.public_id}.pdf`);
        await fetch(`/api/v1/credentials/${resultado.public_id}/upload-certificate`, {
          method: "POST", credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
      } catch (e) { console.warn("Upload certificado R2 falhou:", e); }
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certificado-${resultado.public_id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar certificado.");
    }
  }

  if (loadingData) return <div style={{ padding: 40, color: "#888", fontSize: 14 }}>Carregando...</div>;

  // ===== Step 3: Sucesso =====
  if (step === 3) {
    // Emissão em lote — múltiplos resultados
    if (modoLote && resultadosLote.length > 0) {
      return (
        <div style={{ padding: "28px 32px", maxWidth: 640 }}>
          <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 12, padding: "24px 28px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#065f46", margin: "0 0 8px" }}>{resultadosLote.length} badge{resultadosLote.length !== 1 ? "s" : ""} emitido{resultadosLote.length !== 1 ? "s" : ""} com sucesso!</h2>
            <p style={{ fontSize: 13, color: "#047857", margin: 0 }}>Credenciais registradas na blockchain Polygon.</p>
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {resultadosLote.map((r, i) => (
              <div key={r.public_id} style={{ background: "var(--card-bg,#fff)", border: "1px solid var(--border,#e5e7eb)", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.recipient_name || `Badge ${i + 1}`}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{r.public_id}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {r.tx_hash && (
                    <a href={`https://polygonscan.com/tx/${r.tx_hash}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: "4px 8px", borderRadius: 5, background: "#7c3aed", color: "#fff", textDecoration: "none", fontWeight: 600 }}>Polygon</a>
                  )}
                  {(selectedLot?.tem_documento || selectedLot?.imagem_url) && (
                    <button onClick={async () => {
                      try { const b = await gerarPDF(r); const u = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); const a = document.createElement("a"); a.href = u; a.download = `certificado-${r.public_id}.pdf`; a.click(); URL.revokeObjectURL(u); }
                      catch (e) { toast.error("Erro ao gerar PDF"); }
                    }} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 5, background: "#1A3A5C", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>PDF</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={resetForm} style={{ flex: 1, padding: "10px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#1A3A5C", color: "#fff", border: "none" }}>+ Emitir mais</button>
            <button onClick={() => router.push("/issuer/credentials")} style={{ flex: 1, padding: "10px", borderRadius: 7, fontSize: 13, cursor: "pointer", background: "var(--bg-soft,#f9fafb)", border: "1px solid var(--border,#d1d5db)", color: "var(--text-primary,#111)" }}>Ver credenciais</button>
          </div>
        </div>
      );
    }

    // Emissão única
    if (resultado) return (
      <div style={{ padding: "28px 32px", maxWidth: 560 }}>
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 12, padding: "24px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#065f46", margin: "0 0 8px" }}>Badge emitido com sucesso!</h2>
          <p style={{ fontSize: 13, color: "#047857", margin: 0 }}>Credencial registrada na blockchain Polygon.</p>
        </div>

        <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: "20px 24px", marginTop: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <Row label="Ganhador" value={selectedGanhador?.display_name || resultado.recipient_name} />
            <Row label="Certificação" value={resultado.course_name} />
            <Row label="ID do Badge" value={resultado.public_id} mono />
            {resultado.tx_hash && <Row label="TX Hash" value={resultado.tx_hash} mono />}
          </div>
          {resultado.tx_hash && (
            <a href={`https://polygonscan.com/tx/${resultado.tx_hash}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 16, background: "#7c3aed", color: "#fff", borderRadius: 7, padding: "10px 0", textAlign: "center", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              🔗 Ver no Polygonscan
            </a>
          )}
          {(selectedLot?.tem_documento || selectedLot?.imagem_url) && (
            <button onClick={downloadCertificado}
              style={{ display: "block", width: "100%", marginTop: 10, background: "#1A3A5C", color: "#fff", border: "none", borderRadius: 7, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              📄 Baixar certificado PDF
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={resetForm}
            style={{ flex: 1, padding: "10px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#1A3A5C", color: "#fff", border: "none" }}>
            + Emitir outro badge
          </button>
          <button onClick={() => router.push("/issuer/credentials")}
            style={{ flex: 1, padding: "10px", borderRadius: 7, fontSize: 13, cursor: "pointer", background: "var(--bg-soft, #f9fafb)", border: "1px solid var(--border, #d1d5db)", color: "var(--text-primary, #111)" }}>
            Ver credenciais
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 6 }}>🎖️ Emitir Badge</h1>
      <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, marginBottom: 24 }}>
        Selecione o lote e o ganhador para emitir a certificação na blockchain.
      </p>

      {/* Step indicators */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0 }}>
        {([1, 2] as const).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: s < 2 ? 1 : undefined }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, background: step >= s ? "#1A3A5C" : "#e5e7eb", color: step >= s ? "#fff" : "#9ca3af" }}>{s}</div>
            <span style={{ marginLeft: 8, fontSize: 12, color: step >= s ? "var(--text-primary,#111)" : "#9ca3af", fontWeight: step === s ? 600 : 400 }}>
              {s === 1 ? "Selecionar lote" : "Selecionar ganhador"}
            </span>
            {s < 2 && <div style={{ flex: 1, height: 1, background: step > s ? "#1A3A5C" : "#e5e7eb", margin: "0 12px" }} />}
          </div>
        ))}
      </div>

      {/* ===== Step 1 ===== */}
      {step === 1 && (
        <div>
          {lots.length === 0 && (
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#856404", marginBottom: 16 }}>
              Nenhum lote ativo com saldo disponível. Solicite um lote ao administrador.
            </div>
          )}
          <label style={lblStyle}>Lote *</label>
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            {lots.map((l) => (
              <div key={l.id} onClick={() => setLotId(l.id)} style={{ borderRadius: 9, cursor: "pointer", border: `2px solid ${lotId === l.id ? "#1A3A5C" : "var(--border,#e5e7eb)"}`, background: lotId === l.id ? "rgba(26,58,92,0.05)" : "var(--card-bg,#fff)", overflow: "hidden" }}>
                {l.imagem_url && (
                  <div style={{ height: 60, overflow: "hidden", background: "#f3f4f6" }}>
                    <img src={l.imagem_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
                  </div>
                )}
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary,#111)" }}>{lotName(l)}</span>
                    {l.tem_documento && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }}>Com modelo</span>
                    )}
                    {l.imagem_url && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}>Com imagem</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{l.remaining} disponíveis</span>
                </div>
              </div>
            ))}
          </div>
          <label style={lblStyle}>Certificação</label>
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Ex: Certificado de Conclusão (deixe em branco para padrão)" style={{ ...inpStyle, marginBottom: 16 }} />

          {/* Toggle modo lote */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={modoLote} onChange={(e) => { setModoLote(e.target.checked); setLoteRows([{ nome: "", cpf: "", email: "", ganhadorId: null }]); }}
                style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ color: "var(--text-primary,#111)", fontWeight: 500 }}>Emissão em lote <span style={{ color: "#9ca3af", fontWeight: 400 }}>(múltiplos ganhadores de uma vez)</span></span>
            </label>
          </div>

          <button onClick={() => { if (!lotId) { toast.error("Selecione um lote."); return; } setStep(2); }} disabled={!lotId}
            style={{ width: "100%", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: lotId ? "pointer" : "not-allowed", background: lotId ? "#1A3A5C" : "#e5e7eb", color: lotId ? "#fff" : "#9ca3af", border: "none" }}>
            Próximo →
          </button>
        </div>
      )}

      {/* ===== Step 2 ===== */}
      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}>← Voltar</button>
          <div style={{ background: "rgba(26,58,92,0.04)", border: "1px solid rgba(26,58,92,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
            <span style={{ color: "#6b7280" }}>Lote: </span>
            <span style={{ fontWeight: 600, color: "var(--text-primary,#111)" }}>{selectedLot ? lotName(selectedLot) : "—"}</span>
            <span style={{ color: "#6b7280", marginLeft: 12 }}>{selectedLot?.remaining} disponíveis</span>
          </div>

          {/* ---- MODO LOTE ---- */}
          {modoLote ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={lblStyle}>Ganhadores ({loteRows.length})</label>
                <button onClick={addRow} disabled={!selectedLot || loteRows.length >= selectedLot.remaining}
                  style={{ fontSize: 12, color: "#1A3A5C", background: "none", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
                  + Adicionar linha
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {loteRows.map((row, idx) => (
                  <div key={idx} style={{ background: "var(--card-bg,#fff)", border: "1px solid var(--border,#e5e7eb)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Badge {idx + 1}</span>
                      {loteRows.length > 1 && (
                        <button onClick={() => removeRow(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>Remover</button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Nome *</label>
                        <input value={row.nome} onChange={(e) => updateRow(idx, "nome", e.target.value)}
                          placeholder="Nome completo" style={{ ...inpStyle, fontSize: 12, padding: "6px 10px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>CPF/CNPJ</label>
                        <input value={row.cpf} onChange={(e) => updateRow(idx, "cpf", e.target.value)}
                          placeholder="000.000.000-00" style={{ ...inpStyle, fontSize: 12, padding: "6px 10px" }} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>E-mail</label>
                        <input type="email" value={row.email} onChange={(e) => updateRow(idx, "email", e.target.value)}
                          placeholder="email@exemplo.com" style={{ ...inpStyle, fontSize: 12, padding: "6px 10px" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {emitindoLote && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Emitindo {progressoLote} de {loteRows.filter(r => r.nome.trim()).length}...</div>
                  <div style={{ height: 5, background: "#e5e7eb", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${(progressoLote / Math.max(1, loteRows.filter(r => r.nome.trim()).length)) * 100}%`, background: "#1A3A5C", borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                </div>
              )}
              <button onClick={emitirLote} disabled={emitindoLote}
                style={{ width: "100%", padding: "14px", borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: emitindoLote ? "not-allowed" : "pointer", background: emitindoLote ? "#e5e7eb" : "linear-gradient(135deg,#1A3A5C,#2563eb)", color: emitindoLote ? "#9ca3af" : "#fff", border: "none", boxShadow: emitindoLote ? "none" : "0 4px 14px rgba(26,58,92,0.35)", letterSpacing: 0.5 }}>
                {emitindoLote ? `⏳ Emitindo ${progressoLote}/${loteRows.filter(r => r.nome.trim()).length}...` : `🎖️ EMITIR ${loteRows.filter(r => r.nome.trim()).length} BADGE${loteRows.filter(r => r.nome.trim()).length !== 1 ? "S" : ""}`}
              </button>
            </div>
          ) : (
            /* ---- MODO ÚNICO ---- */
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={lblStyle}>Ganhador *</label>
                <button onClick={() => setShowNovoGanhador(true)}
                  style={{ fontSize: 12, color: "#1A3A5C", background: "none", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
                  + Novo ganhador
                </button>
              </div>
              <input value={ganhadorSearch} onChange={(e) => setGanhadorSearch(e.target.value)} placeholder="Buscar por nome, CPF ou e-mail..." style={{ ...inpStyle, marginBottom: 10 }} />
              <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 6, marginBottom: 20 }}>
                {filteredGanhadores.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    {ganhadorSearch ? "Nenhum resultado." : "Nenhum ganhador cadastrado. Clique em + Novo ganhador."}
                  </div>
                ) : filteredGanhadores.map((g) => (
                  <div key={g.id} onClick={() => setGanhadorId(g.id)} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: `2px solid ${ganhadorId === g.id ? "#1A3A5C" : "var(--border,#e5e7eb)"}`, background: ganhadorId === g.id ? "rgba(26,58,92,0.05)" : "var(--card-bg,#fff)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary,#111)" }}>{g.display_name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      {g.tipo}{g.cpf_cnpj ? ` · ${g.cpf_cnpj}` : ""}{g.email ? ` · ${g.email}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={emitir} disabled={emitting || !ganhadorId}
                style={{ width: "100%", padding: "14px", borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: ganhadorId && !emitting ? "pointer" : "not-allowed", background: ganhadorId && !emitting ? "linear-gradient(135deg,#1A3A5C,#2563eb)" : "#e5e7eb", color: ganhadorId && !emitting ? "#fff" : "#9ca3af", border: "none", boxShadow: ganhadorId && !emitting ? "0 4px 14px rgba(26,58,92,0.35)" : "none", letterSpacing: 0.5 }}>
                {emitting ? "⏳ Emitindo na blockchain..." : "🎖️ EMITIR BADGE"}
              </button>
              {emitting && <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>Aguardando confirmação da transação Polygon...</p>}
            </div>
          )}
        </div>
      )}

      {/* Modal novo ganhador inline */}
      {showNovoGanhador && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowNovoGanhador(false)}>
          <div style={{ background: "var(--card-bg,#fff)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "var(--text-primary,#111)" }}>Novo ganhador</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["PF", "PJ"] as const).map((t) => (
                <button key={t} onClick={() => setNovoTipo(t)}
                  style={{ flex: 1, padding: "7px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: novoTipo === t ? "#1A3A5C" : "var(--bg-soft,#f9fafb)", color: novoTipo === t ? "#fff" : "var(--text-primary,#111)", border: `1px solid ${novoTipo === t ? "#1A3A5C" : "var(--border,#d1d5db)"}` }}>
                  {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {novoTipo === "PF" ? (
                <>
                  <InlineField label="Nome *" value={novoNome} onChange={setNovoNome} />
                  <InlineField label="CPF" value={novoCpf} onChange={setNovoCpf} />
                </>
              ) : (
                <>
                  <InlineField label="Razão Social *" value={novoRazao} onChange={setNovoRazao} />
                  <InlineField label="CNPJ" value={novoCnpj} onChange={setNovoCnpj} />
                </>
              )}
              <InlineField label="E-mail" value={novoEmail} onChange={setNovoEmail} type="email" />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowNovoGanhador(false)}
                style={{ flex: 1, padding: "8px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: "var(--bg-soft,#f9fafb)", border: "1px solid var(--border,#d1d5db)", color: "var(--text-primary,#111)" }}>
                Cancelar
              </button>
              <button onClick={salvarNovoGanhador} disabled={salvandoGanhador}
                style={{ flex: 2, padding: "8px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#1A3A5C", color: "#fff", border: "none" }}>
                {salvandoGanhador ? "Salvando..." : "Cadastrar e selecionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MODELO A — Badge One Certificate ─────────────────────────────────────────
// Layout: [BENEFICIÁRIO] [EMISSOR] [QR quadrado proporcional]
// QR ocupa coluna com largura = altura do bloco (quadrado perfeito)
async function renderBlocoAssinatura(pdfDoc: any, page: any, pos: any, data: {
  nomeGanhador: string;
  cpfCnpj: string;
  dataISO: string;
  tokenId: string;
  badgeId: string;
  txHash: string;
  font: any;
  fontBold: any;
  loteNome?: string;
  orgNome?: string;
  orgCnpj?: string;
  verifyUrl?: string;
}) {
  const { rgb } = await import("pdf-lib");
  const QRCode = await import("qrcode");
  const { x, y, width = 310, height = 90 } = pos;

  const pad = 8;
  const lineH = 9;

  // QR é quadrado = altura do bloco inteira (menos padding vertical)
  const qrSize = height - pad * 2;
  const qrColW = qrSize + pad * 2;          // largura da coluna do QR
  const textW = width - qrColW;             // largura total das 2 colunas de texto
  const col1W = Math.floor(textW / 2);
  const col2X = x + col1W;
  const qrX = x + width - qrSize - pad;
  const sep1X = col2X;
  const sep2X = x + width - qrColW;

  // Fundo branco + borda
  page.drawRectangle({ x, y, width, height, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1.5, color: rgb(1, 1, 1) });

  // Separadores verticais
  page.drawLine({ start: { x: sep1X, y: y + pad }, end: { x: sep1X, y: y + height - pad }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });
  page.drawLine({ start: { x: sep2X, y: y + pad }, end: { x: sep2X, y: y + height - pad }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });

  const topY = y + height - pad - 7;

  // ── Col 1: BENEFICIÁRIO ──
  const c1 = x + pad;
  page.drawText("BENEFICIÁRIO", { x: c1, y: topY, size: 5.5, font: data.font, color: rgb(0.55, 0.55, 0.55) });
  let y1 = topY - lineH;
  page.drawText(data.nomeGanhador || "—", { x: c1, y: y1, size: 9, font: data.fontBold, color: rgb(0, 0, 0) });
  y1 -= lineH;
  if (data.cpfCnpj) {
    page.drawText(`CPF: ${data.cpfCnpj}`, { x: c1, y: y1, size: 7, font: data.font, color: rgb(0.2, 0.2, 0.2) });
    y1 -= lineH;
  }
  if (data.loteNome) {
    page.drawText(data.loteNome, { x: c1, y: y1, size: 7, font: data.font, color: rgb(0.2, 0.2, 0.2) });
    y1 -= lineH;
  }
  page.drawText(`Token ID: ${data.tokenId}`, { x: c1, y: y1, size: 7, font: data.font, color: rgb(0.2, 0.2, 0.2) });

  // ── Col 2: EMISSOR ──
  const c2 = col2X + pad / 2;
  page.drawText("EMISSOR", { x: c2, y: topY, size: 5.5, font: data.font, color: rgb(0.55, 0.55, 0.55) });
  let y2 = topY - lineH;
  page.drawText(data.orgNome || "—", { x: c2, y: y2, size: 9, font: data.fontBold, color: rgb(0, 0, 0) });
  y2 -= lineH;
  if (data.orgCnpj) {
    page.drawText(`CNPJ: ${data.orgCnpj}`, { x: c2, y: y2, size: 7, font: data.font, color: rgb(0.2, 0.2, 0.2) });
    y2 -= lineH;
  }
  const dataFormatada = data.dataISO
    ? new Date(data.dataISO).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  if (dataFormatada) {
    page.drawText(`Data: ${dataFormatada}`, { x: c2, y: y2, size: 7, font: data.font, color: rgb(0.2, 0.2, 0.2) });
    y2 -= lineH;
  }
  page.drawText(`Public ID: ${data.badgeId}`, { x: c2, y: y2, size: 6.5, font: data.font, color: rgb(0.2, 0.2, 0.2) });

  // ── Col 3: QR Code quadrado — aponta para /verify/{id} ──
  const qrTarget = data.verifyUrl || `https://polygonscan.com/tx/${data.txHash}`;
  const qrDataUrl = await QRCode.default.toDataURL(qrTarget, { width: 256, margin: 1 });
  const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImg = await pdfDoc.embedPng(qrBytes);
  const qrY = y + pad;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  // label abaixo do QR não cabe (bloco quadrado já preenche tudo) — textos omitidos
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary,#111)", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all", textAlign: "right" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function InlineField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 3 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "var(--card-bg,#fff)", color: "var(--text-primary,#111)" }} />
    </div>
  );
}

const lblStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary,#555)", marginBottom: 8 };
const inpStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid var(--border,#d1d5db)", borderRadius: 7, fontSize: 14, background: "var(--card-bg,#fff)", color: "var(--text-primary,#111)", boxSizing: "border-box" };
