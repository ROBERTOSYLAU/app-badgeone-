# Proximas Tarefas — BadgeOne
> Atualizado em: 25 de marco de 2026 as 20:09 (Horario de Brasilia)

---

## ENTENDIMENTO DO PRODUTO

### Badge One Certificate (Lote)
- Organização compra lote de N badges
- Cada badge = 1 certificado emitido (carimbo: EMISSOR + GANHADOR + QR)
- Ao comprar lote: ganha automaticamente 1 ano de licença de assinatura grátis
- Badges não têm prazo — ficam disponíveis até serem usados

### Badge One Sign (Licença Anual)
- Paga 1x por ano — assina documentos ilimitadamente
- Carimbo: só EMISSOR + QR (sem ganhador)
- Não permite emitir certificados com ganhador
- Pode ser vendido como certificado digital padrão de mercado

### Hierarquia de acesso
```
TEM LOTE → emite certificado + assina documentos (usa a licença bônus)
TEM SÓ LICENÇA SIGN → assina documentos (não emite certificado)
LICENÇA VENCIDA → renovar por R$50/ano (não desperdiça badges que valem R$5 cada)
```

---

## O QUE FOI FEITO ✅

### Carimbo Visual (MODELO A e B)
- [x] MODELO A — Badge One Certificate: 3 colunas (BENEFICIÁRIO | EMISSOR | QR quadrado)
- [x] MODELO B — Badge One Sign: 2 colunas (ASSINANTE | QR quadrado proporcional)
- [x] QR Code em ambos os modelos aponta para /verify/{public_id}
- [x] Botão "Pré-assinar" abre modal → botão do modal é "Assinar"

### Lotes com Imagem de Fundo
- [x] Upload de imagem no cadastro/edição de lote (admin)
- [x] Armazenamento no Cloudflare R2 (lot-images/{loteId}.{ext})
- [x] Preview da imagem na listagem (issuer/lots) e na seleção de emissão
- [x] PDF gerado usa imagem como fundo + carimbo automático por cima

### Emissão em Massa com Ganhadores
- [x] Toggle "Emissão em lote" na tela de emissão
- [x] Campos dinâmicos: 1 linha por badge (nome + CPF + email)
- [x] Botão "Emitir N badges" com progresso em tempo real
- [x] Tela de resultado com todos os badges + botão PDF individual

### Badge One Sign — Assinador Digital
- [x] Tela de upload de documento PDF (/issuer/sign)
- [x] Posicionamento interativo do bloco (arrastar + redimensionar)
- [x] Carimbo MODELO B aplicado com pdf-lib
- [x] Registro na blockchain Polygon (Token ID + TX Hash)
- [x] Metadados salvos no R2 como JSON — sign/{publicId}.json
- [x] PDF assinado salvo no R2 — sign/{publicId}.pdf

### Verificação Pública (/verify/[id])
- [x] Detecta automaticamente se é Badge ou Sign pelo public_id
- [x] Badge: exibe emissor, organização, ganhador, data, link PDF, Polygonscan
- [x] Sign: exibe título, finalidade, partes, hash, blockchain, link PDF
- [x] Página acessível sem login (QR Code funcional)

### Sistema de Licenças e Planos
- [x] Model LicencaAssinatura (valid_from, valid_until, tipo bonus/paid, lote_origem_id)
- [x] Ao criar lote: concede/estende automaticamente +1 ano de licença grátis
- [x] GET /licenca/status — retorna ativa, validade, dias restantes, alerta (≤30 dias)
- [x] POST /licenca/renovar — renova por +1 ano (tipo paid)
- [x] sign/prepare valida licença ativa antes de registrar na blockchain (403 se inativa)
- [x] Página /issuer/planos — status da licença, créditos por lote, botão renovar
- [x] /issuer/sign — banner verde/amarelo/vermelho com status da licença
- [x] Menu lateral — indicador 🟢/🟡/🔴 + item "Planos"

### Infraestrutura
- [x] Deploy em produção via Docker Compose (backend + frontend + nginx + postgres + redis)
- [x] Integração Cloudflare R2 para armazenamento de PDFs, imagens e JSONs
- [x] Integração Polygon blockchain (mint badge + register document)
- [x] Alertas de vencimento de lote + chat de suporte em tempo real (WebSocket)

---

## O QUE PODE SER FEITO EM BREVE 🔜

### ALTA PRIORIDADE

#### Pagamento dentro da plataforma
- [ ] Integração com gateway (Pagar.me ou Stripe) — Pix + cartão
- [ ] Checkout para comprar lote de badges dentro do painel
- [ ] Checkout para renovar licença Sign dentro do painel
- [ ] Histórico de pagamentos no painel do emissor
- [ ] Geração de nota fiscal / recibo simples por email

#### Cliente Pessoa Física (PF)
- [ ] Cadastro simplificado sem CNPJ obrigatório
- [ ] Fluxo de onboarding para PF (só quer assinar documentos)
- [ ] Painel PF separado do painel de organizações
- [ ] Licença Sign individual para PF (R$50/ano)

#### Email automático
- [ ] Envio do certificado PDF para o ganhador por email ao emitir
- [ ] Aviso 30 dias antes da licença vencer (para renovação)
- [ ] Aviso quando saldo de badges estiver baixo (ex: menos de 10)

### MÉDIA PRIORIDADE

#### Melhorias no Assinador
- [ ] Suporte a imagem (JPG/PNG) além de PDF no Badge One Sign
- [ ] Múltiplos blocos de assinatura em um mesmo documento
- [ ] Assinatura em lote de documentos (assinar N arquivos de uma vez)
- [ ] Histórico de documentos assinados no painel (/issuer/sign/historico)

#### Melhorias no Certificado
- [ ] Importar ganhadores via CSV na emissão em lote
- [ ] Template de certificado personalizável (fonte, cor, logo da org)
- [ ] Preview do certificado antes de emitir
- [ ] Revogar certificado com motivo registrado na blockchain

#### Painel Admin
- [ ] Dashboard financeiro — receita por mês, churn, LTV
- [ ] Gestão de licenças — ver todas as orgs, vencimentos, renovações
- [ ] Ativação/bloqueio manual de licença por org

### BAIXA PRIORIDADE / FUTURO

- [ ] App mobile para verificar badges (câmera → QR → /verify)
- [ ] Widget de verificação para incorporar em sites (embed)
- [ ] API pública para integração de terceiros (emitir badge via API)
- [ ] Suporte a múltiplos idiomas (EN, ES)
- [ ] Relatório de engajamento (quantos QRs escaneados por badge)

---

## ARQUIVOS PRINCIPAIS

| Arquivo | Função |
|---|---|
| `frontend/src/app/(private)/issuer/emit/page.tsx` | Emissão single + lote + gerarPDF MODELO A |
| `frontend/src/app/(private)/issuer/sign/page.tsx` | Assinador digital + carimbo MODELO B |
| `frontend/src/app/(private)/issuer/planos/page.tsx` | Página de planos e licenças |
| `frontend/src/app/verify/[id]/page.tsx` | Verificação pública (badge ou sign) |
| `backend/app/api/v1/endpoints/credentials.py` | Emissão + verify badge |
| `backend/app/api/v1/endpoints/sign.py` | Prepare + upload + verify sign |
| `backend/app/api/v1/endpoints/licenca.py` | Status + renovar + admin licenças |
| `backend/app/api/v1/endpoints/lots.py` | CRUD lotes + upload imagem + concede licença |
| `backend/app/models/licenca_assinatura.py` | Model de licença anual |
| `backend/app/integrations/r2_storage.py` | Upload Cloudflare R2 |
| `backend/app/integrations/blockchain.py` | Mint badge + register document Polygon |
| `design/tarefas/LICENCAS_E_PLANOS.md` | Plano detalhado do sistema de licenças (concluído) |
| `design/inspiracao/CARIMBO .jpg` | Referência visual dos dois modelos de carimbo |
