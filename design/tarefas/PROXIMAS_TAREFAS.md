# Proximas Tarefas — BadgeOne
> Atualizado em: 25 de marco de 2026 as 19:15 (Horario de Brasilia)

---

## ENTENDIMENTO DO PRODUTO

### Badge One Certificate
- Cada LOTE tem uma imagem de fundo (ex: arte do certificado) anexada e fixada
- O CARIMBO do certificado é aplicado sobre essa imagem
- A imagem só muda se o emissor quiser alterar manualmente
- Na emissão em lote: 1 badge = 1 ganhador
  - Ex: 10 badges no lote = 10 ganhadores a preencher
  - Interface deve abrir campos para incluir cada ganhador (nome, CPF, etc.)

### Badge One Sign (Assinador Digital)
- O usuário anexa qualquer documento (PDF ou imagem)
- O CARIMBO de assinatura digital é aplicado sobre o documento
- Fluxo: upload → posicionar bloco → "Pré-assinar" → preencher modal → "Assinar"
- Metadados (título, finalidade, partes, descrição) vão para blockchain + JSON no R2
- Esses dados NÃO aparecem no carimbo — carimbo só tem ASSINANTE + QR

---

## CARIMBO — LAYOUT DEFINIDO

### MODELO A — Badge One Certificate
```
┌─────────────────────┬─────────────────────┬──────┐
│ BENEFICIÁRIO        │ EMISSOR             │  QR  │
│ Nome do ganhador    │ Org nome            │  []  │
│ CPF: ***            │ CNPJ: ...           │      │
│ Certificação: ...   │ Token ID: ...       │      │
│                     │ badgeone.com.br     │      │
└─────────────────────┴─────────────────────┴──────┘
```
- 3 colunas: BENEFICIÁRIO | EMISSOR | QR quadrado proporcional
- QR aponta para /verify/{public_id}

### MODELO B — Badge One Sign
```
┌──────────────────────────────────────┬──────┐
│ Assinado digitalmente por            │  QR  │
│ Org nome (bold)                      │  []  │
│ CNPJ: ...                            │      │
│ Data: DD/MM/AAAA HH:MM               │      │
│ Public ID: ...  Token ID: ...        │      │
└──────────────────────────────────────┴──────┘
```
- 2 colunas: ASSINANTE | QR quadrado proporcional
- QR aponta para /verify/{public_id}

---

## O QUE FOI FEITO

### 1. CARIMBO — Geração Visual
- [x] Implementar gerador do Carimbo Certificate — MODELO A (3 cols, QR quadrado)
- [x] Implementar gerador do Carimbo Sign — MODELO B (2 cols, QR quadrado proporcional)
- [x] Aplicar o carimbo sobre a imagem/documento anexado (pdf-lib)
- [x] QR Code aponta para a página de verificação pública (/verify/[id])
- [x] Botão "Pré-assinar" abre modal → botão do modal é "Assinar"

### 2. LOTES COM IMAGEM DE FUNDO
- [x] Adicionar campo de upload de imagem no cadastro/edição de LOTE (admin)
- [x] Armazenar imagem do lote no Cloudflare R2 (lot-images/{loteId}.{ext})
- [x] Exibir preview da imagem do lote na listagem (issuer/lots) e na seleção de emissão
- [x] Imagem fica fixada no lote, só muda se o admin alterar
- [x] PDF gerado usa imagem como fundo + bloco_assinatura automático por cima

### 3. EMISSÃO EM MASSA COM GANHADORES
- [x] Toggle "Emissão em lote" na tela de emissão
- [x] Campos dinâmicos: 1 linha por badge (nome + CPF + email)
- [x] Botão "Emitir N badges" com progresso em tempo real
- [x] Tela de resultado com todos os badges + botão PDF individual

### 4. BADGE ONE SIGN — Assinador Digital
- [x] Tela de upload de documento (PDF) — /issuer/sign
- [x] Posicionamento interativo do bloco (drag + resize)
- [x] Carimbo MODELO B: 2 cols (ASSINANTE + QR quadrado proporcional)
- [x] Metadados salvos na blockchain Polygon (titulo, finalidade, partes, descricao, hash)
- [x] Metadados salvos no R2 como JSON — sign/{publicId}.json
- [x] PDF assinado salvo no R2 — sign/{publicId}.pdf
- [x] Página de verificação pública da assinatura

### 5. VERIFICAÇÃO PÚBLICA (/verify/[id])
- [x] Detecta automaticamente se é Sign ou Badge
- [x] Badge: mostrar emissor, organização, data de emissão, link download PDF
- [x] Sign: mostrar título, finalidade, partes, data, blockchain info
- [x] Confirmar autenticidade via blockchain (link Polygonscan)

---

## O QUE FALTA / PRÓXIMAS TAREFAS

### TESTES & VALIDAÇÃO (PRIORIDADE ALTA)
- [ ] Testar fluxo completo do Sign: upload PDF → posicionar → pré-assinar → modal → assinar → verificar /verify/{id}
- [ ] Testar emissão em lote: 3+ ganhadores simultâneos, verificar PDFs individuais
- [ ] Testar upload de imagem no lote e verificar que aparece no PDF gerado
- [ ] Verificar que QR no carimbo leva para /verify/{id} correto (Certificate e Sign)

### MELHORIAS FUTURAS
- [ ] Importar ganhadores via CSV na emissão em lote
- [ ] Envio de email automático para ganhador com link do certificado
- [ ] Dashboard de assinaturas (listagem de documentos assinados pelo issuer)
- [ ] Revogar/cancelar assinatura digital pelo admin
- [ ] Suporte a imagem (JPG/PNG) além de PDF no Badge One Sign

---

## ARQUIVOS PRINCIPAIS

| Arquivo | Função |
|---|---|
| `frontend/src/app/(private)/issuer/emit/page.tsx` | Emissão de badges (single + lote) + gerarPDF com carimbo MODELO A |
| `frontend/src/app/(private)/issuer/sign/page.tsx` | Assinador digital + carimbo MODELO B |
| `frontend/src/app/verify/[id]/page.tsx` | Verificação pública (badge ou sign) |
| `backend/app/api/v1/endpoints/credentials.py` | Emissão + verify badge |
| `backend/app/api/v1/endpoints/sign.py` | Prepare + upload + verify sign |
| `backend/app/api/v1/endpoints/lots.py` | CRUD lotes + upload imagem |
| `backend/app/integrations/r2_storage.py` | Upload Cloudflare R2 |
| `backend/app/integrations/blockchain.py` | Mint badge + register document Polygon |
| `design/inspiracao/CARIMBO .jpg` | Referência visual dos dois modelos de carimbo |
