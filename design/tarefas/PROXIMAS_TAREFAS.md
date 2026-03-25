# Proximas Tarefas — BadgeOne
> Atualizado em: 25 de marco de 2026 as 20:31 (Horario de Brasilia)

---

## ENTENDIMENTO DO PRODUTO

### Badge One Certificate (Lote)
- Organização compra lote de N badges
- Cada badge = 1 certificado emitido (carimbo: EMISSOR + GANHADOR + QR)
- Ao comprar lote: ganha automaticamente 1 ano de licença de assinatura grátis
- Badges não têm prazo — ficam disponíveis até serem usados

### Badge One Sign (Licença Anual)
- Licença ativada SOMENTE pelo admin (anual ou data personalizada)
- Assina documentos ilimitadamente pelo período da licença
- Carimbo: só EMISSOR + QR (sem ganhador)
- Não permite emitir certificados com ganhador

### Hierarquia de acesso
```
TEM LICENÇA ATIVA     → assina documentos ilimitado
TEM BADGES (sem lic.) → pode usar 1 badge por assinatura (com aviso de custo)
SEM NENHUM            → "Sua assinatura não está ativa. Fale com o administrador."
LICENÇA SÓ ADMIN      → emissor não ativa nem renova pelo painel
```

---

## O QUE FOI FEITO ✅

### Carimbo Visual
- [x] MODELO A — Certificate: 3 colunas (BENEFICIÁRIO | EMISSOR | QR quadrado)
- [x] MODELO B — Sign: 2 colunas (ASSINANTE | QR quadrado proporcional)
- [x] QR aponta para /verify/{public_id} em ambos os modelos
- [x] Botão "Pré-assinar" abre modal → botão do modal é "Assinar"

### Lotes com Imagem de Fundo
- [x] Upload de imagem no lote (admin) → R2 (lot-images/{loteId}.{ext})
- [x] Preview da imagem no issuer/lots e na seleção de emissão
- [x] PDF gerado usa imagem como fundo + carimbo por cima

### Emissão em Massa com Ganhadores
- [x] Toggle "Emissão em lote" na tela de emissão
- [x] Campos dinâmicos por ganhador (nome + CPF + email)
- [x] Progresso em tempo real + resultado com PDF individual por badge

### Badge One Sign — Assinador Digital
- [x] Upload PDF + posicionamento interativo do bloco (drag + resize)
- [x] Carimbo MODELO B aplicado com pdf-lib
- [x] Registro na blockchain Polygon (Token ID + TX Hash)
- [x] PDF assinado + JSON de metadados salvos no R2

### Sistema de Licenças
- [x] Model LicencaAssinatura (valid_from, valid_until, tipo, lote_origem_id)
- [x] Ao criar lote: concede automaticamente +1 ano de licença bonus
- [x] GET /licenca/status — retorna ativa, validade, dias restantes, alerta, saldo_badges
- [x] POST /licenca/admin/conceder — admin escolhe org + tipo anual ou data personalizada
- [x] Licença NÃO pode ser ativada pelo emissor — somente admin
- [x] sign/prepare — 3 cenários:
    - Licença ativa → assina normalmente
    - Sem licença + tem badges → retorna 402, frontend pergunta se quer usar 1 badge
    - Sem licença + sem badges → 403 "Sua assinatura não está ativa"
- [x] Modal de confirmação ao usar badge (com dica: renovar R$50/ano é mais barato)
- [x] Banner de status na tela de assinatura (verde/amarelo/vermelho)
- [x] Página /issuer/planos — exibe status, créditos, mensagem "ativação pelo admin"
- [x] Menu lateral — indicador 🟢/🟡/🔴 + item Planos

### Verificação Pública (/verify/[id])
- [x] Detecta automaticamente Badge ou Sign pelo public_id
- [x] Badge: emissor, organização, ganhador, data, Polygonscan, PDF
- [x] Sign: título, finalidade, partes, hash, blockchain, PDF

### Infraestrutura
- [x] Deploy em produção via Docker Compose (backend + frontend + nginx + postgres + redis)
- [x] Cloudflare R2 para PDFs, imagens e JSONs de metadados
- [x] Integração Polygon blockchain (mint badge + register document)
- [x] Alertas de vencimento de lote + chat de suporte em tempo real (WebSocket)

---

## O QUE PODE MELHORAR EM BREVE 🔜

### ALTA PRIORIDADE

#### Painel Admin — Gestão de Licenças
- [ ] Tela no admin para listar todas as licenças por organização
- [ ] Botão "Conceder licença" por org diretamente no painel (sem precisar da API)
- [ ] Ver status de cada org: ativa / vencida / sem licença / dias restantes
- [ ] Histórico de licenças concedidas por organização

#### Pagamento dentro da plataforma
- [ ] Integração com gateway (Pagar.me ou Stripe) — Pix + cartão
- [ ] Checkout para comprar lote de badges dentro do painel
- [ ] Checkout para renovar licença Sign dentro do painel
- [ ] Histórico de pagamentos no painel do emissor
- [ ] Quando o emissor paga, licença é ativada automaticamente (sem precisar do admin)

#### Email automático
- [ ] Envio do certificado PDF para o ganhador por email ao emitir
- [ ] Aviso 30 dias antes da licença vencer (email para o emissor)
- [ ] Aviso quando saldo de badges estiver baixo (menos de 10)

### MÉDIA PRIORIDADE

#### Cliente Pessoa Física (PF)
- [ ] Cadastro simplificado sem CNPJ obrigatório
- [ ] Fluxo de onboarding para PF (só quer assinar documentos)
- [ ] Licença Sign individual para PF (R$50/ano)

#### Melhorias no Assinador
- [ ] Suporte a imagem (JPG/PNG) além de PDF no Badge One Sign
- [ ] Histórico de documentos assinados no painel (/issuer/sign/historico)
- [ ] Múltiplos blocos de assinatura em um mesmo documento

#### Melhorias no Certificado
- [ ] Importar ganhadores via CSV na emissão em lote
- [ ] Preview do certificado antes de emitir
- [ ] Template de certificado personalizável (fonte, cor, logo da org)

### BAIXA PRIORIDADE / FUTURO

- [ ] App mobile para verificar badges (câmera → QR → /verify)
- [ ] Widget de verificação para incorporar em sites (embed)
- [ ] API pública para integração de terceiros (emitir badge via API)
- [ ] Relatório de engajamento (quantos QRs escaneados por badge)

---

## ARQUIVOS PRINCIPAIS

| Arquivo | Função |
|---|---|
| `frontend/src/app/(private)/issuer/emit/page.tsx` | Emissão single + lote + gerarPDF MODELO A |
| `frontend/src/app/(private)/issuer/sign/page.tsx` | Assinador digital + carimbo MODELO B + fluxo badge |
| `frontend/src/app/(private)/issuer/planos/page.tsx` | Status de licença e créditos (somente leitura) |
| `frontend/src/app/verify/[id]/page.tsx` | Verificação pública (badge ou sign) |
| `backend/app/api/v1/endpoints/credentials.py` | Emissão + verify badge |
| `backend/app/api/v1/endpoints/sign.py` | Prepare (valida licença/badge) + upload + verify |
| `backend/app/api/v1/endpoints/licenca.py` | Status + admin/conceder + admin/todas |
| `backend/app/api/v1/endpoints/lots.py` | CRUD lotes + upload imagem + concede licença bonus |
| `backend/app/models/licenca_assinatura.py` | Model de licença anual |
| `backend/app/integrations/r2_storage.py` | Upload Cloudflare R2 |
| `backend/app/integrations/blockchain.py` | Mint badge + register document Polygon |
