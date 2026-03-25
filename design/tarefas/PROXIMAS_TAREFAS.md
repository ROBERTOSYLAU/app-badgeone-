# Proximas Tarefas — BadgeOne
> Atualizado em: 25 de marco de 2026 as 19:59

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
- O usuário anexa qualquer documento (PDF, imagem, contrato)
- O CARIMBO de assinatura digital é aplicado sobre o documento
- Funciona de forma independente do sistema de lotes/badges

---

## O QUE PRECISA SER FEITO

### 1. CARIMBO — Geração Visual (PRIORIDADE ALTA)
- [ ] Implementar gerador do Carimbo Certificate (com dados do ganhador + QR Code)
- [ ] Implementar gerador do Carimbo Sign (com dados da empresa + QR Code)
- [ ] Aplicar o carimbo sobre a imagem/documento anexado (usar canvas ou biblioteca PDF)
- [ ] QR Code deve apontar para a página de verificação pública (/verify/[id])

### 2. LOTES COM IMAGEM DE FUNDO
- [ ] Adicionar campo de upload de imagem no cadastro/edição de LOTE
- [ ] Armazenar imagem do lote (Cloudflare R2 já está configurado)
- [ ] Exibir preview da imagem do lote antes de emitir
- [ ] Imagem fica fixada no lote, só muda se o emissor alterar

### 3. EMISSÃO EM MASSA COM GANHADORES
- [ ] Na tela de emissão, mostrar campos dinâmicos: 1 linha por badge
  - Ex: Lote com 10 badges → abrir 10 linhas para preencher nome + CPF de cada ganhador
- [ ] Opção de importar ganhadores via CSV (futuro)
- [ ] Após preencher, gerar todos os certificados de uma vez

### 4. BADGE ONE SIGN — Assinador Digital
- [ ] Tela para upload de documento (PDF ou imagem)
- [ ] Aplicar carimbo de assinatura digital sobre o documento
- [ ] Gerar documento final assinado para download
- [ ] Registrar assinatura na blockchain (Token ID + Public ID)
- [ ] Página de verificação pública da assinatura

### 5. VERIFICAÇÃO PÚBLICA (/verify/[id])
- [ ] Exibir dados do certificado ou assinatura
- [ ] Mostrar carimbo visualmente
- [ ] Confirmar autenticidade via blockchain

---

## ARQUIVOS DE REFERENCIA

- Carimbo visual: `design/inspiracao/CARIMBO .jpg`
- Backend assinatura: `backend/app/api/v1/endpoints/sign.py` (ja existe, verificar)
- Storage R2: `backend/app/integrations/r2_storage.py` (ja existe)
- Modelos: `backend/app/models/assinatura_digital.py`, `lote_documento.py`

---

## ORDEM SUGERIDA DE EXECUCAO

1. Implementar upload de imagem no lote
2. Implementar gerador visual do carimbo (Certificate)
3. Implementar emissao em massa com campos de ganhadores
4. Implementar Badge One Sign (assinador)
5. Atualizar página de verificação pública
