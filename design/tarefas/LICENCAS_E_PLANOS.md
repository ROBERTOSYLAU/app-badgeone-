# Plano: Sistema de Licenças e Planos — BadgeOne
> Criado em: 25 de marco de 2026 as 19:30 (Horario de Brasilia)
> Atualizado em: 25 de marco de 2026 as 19:50 (Horario de Brasilia)
> Status: CONCLUIDO

---

## MODELO DE NEGÓCIO DEFINIDO

### Produto 1 — Badge One Certificate (Lote)
- Organização compra lote de N badges (ex: 50 badges = R$ 250,00)
- Cada badge consumido = 1 certificado emitido (carimbo: EMISSOR + GANHADOR)
- **Ao ativar o lote: ganha automaticamente 1 ano de assinatura digital grátis**
- Badges não têm prazo de validade — ficam disponíveis até serem usados

### Produto 2 — Badge One Sign (Licença Anual)
- Organização ou PF paga R$ 50,00/ano
- Assina documentos ilimitadamente pelo período
- Carimbo: só EMISSOR (sem ganhador)
- Não permite emitir certificados com ganhador

### Hierarquia de acesso
```
TEM LOTE ATIVO
  ✓ Emitir certificado (emissor + ganhador) — consome 1 badge
  ✓ Assinar documento — usa a licença anual (grátis ao comprar lote)

TEM SÓ LICENÇA SIGN
  ✗ Emitir certificado — bloqueado
  ✓ Assinar documento — usa a licença anual paga

LICENÇA VENCIDA (tem lote com badges sobrando)
  ✓ Emitir certificado — badges preservados
  ✗ Assinar documento — bloqueado, oferecer renovação R$ 50,00/ano
  ✗ NÃO consome badge para assinar — badge vale R$ 5,00 cada,
    renovação vale R$ 50,00/ano inteiro → sempre mais barato renovar
```

### Ciclo de retenção
```
Ano 1:  compra lote 50 badges R$250 → ganha assinatura grátis
        usa 30 badges para certificados → sobram 20
Ano 2:  assinatura vence → renova por R$50 → preserva 20 badges
Ano 3:  badges esgotaram → compra novo lote R$250 → ganha +1 ano grátis
```

---

## O QUE PRECISA SER IMPLEMENTADO

### FASE 1 — Backend: Modelo de Licença

#### 1.1 Novo model: LicencaAssinatura
```
backend/app/models/licenca_assinatura.py

id, organization_id, valid_from, valid_until,
tipo (bonus|paid), lote_origem_id (FK opcional),
status (active|expired|cancelled), created_at
```

#### 1.2 Migração automática da tabela
- Adicionar em `ensure_columns()` no startup

#### 1.3 Concessão automática ao ativar lote
- Em `POST /lots` (criar) OU quando lote é ativado:
  - Verificar se org já tem licença ativa
  - Se não tem: criar `LicencaAssinatura` com valid_until = hoje + 1 ano, tipo = "bonus", lote_origem_id = lote.id
  - Se já tem licença ativa: estender a validade por +1 ano (ou manter a maior)
- [ ] Implementar em `backend/app/api/v1/endpoints/lots.py`

#### 1.4 Validação de licença no sign/prepare
- Antes de registrar na blockchain: checar se org tem licença ativa
- Se não tem: retornar 403 com `detail: "licenca_inativa"` e `valid_until`
- [ ] Implementar em `backend/app/api/v1/endpoints/sign.py`

#### 1.5 Novos endpoints de licença
```
GET  /licenca/status        → retorna licença ativa da org do usuário logado
POST /licenca/renovar       → cria nova licença paid por 1 ano (futuramente integra pagamento)
GET  /admin/licencas        → lista todas licenças (admin only)
```
- [ ] Criar `backend/app/api/v1/endpoints/licenca.py`
- [ ] Registrar no router

---

### FASE 2 — Frontend: Integração de Licença

#### 2.1 Tela /issuer/sign — validar licença antes de assinar
- Ao carregar a página: buscar `GET /api/v1/licenca/status`
- Se licença ativa: mostrar validade no topo ("Licença ativa até DD/MM/AAAA")
- Se sem licença ou vencida: bloquear upload, mostrar banner de upgrade
  - [ ] "Você não tem licença ativa. Compre um lote de badges ou renove sua assinatura."
  - [ ] Botão: [ Comprar lote ] [ Renovar assinatura R$50/ano ]

#### 2.2 Nova página /issuer/planos
- Seção "Minha Licença de Assinatura":
  - Status atual (ativa/vencida) + data de validade
  - Botão renovar (R$ 50,00/ano)
- Seção "Meus Lotes / Créditos":
  - Lista de lotes ativos com saldo restante
  - Botão comprar mais créditos (futuro: integração pagamento)
- [ ] Criar `frontend/src/app/(private)/issuer/planos/page.tsx`

#### 2.3 Layout do issuer — indicador de licença
- Adicionar no menu lateral: ícone de status da licença
  - Verde: ativa
  - Amarelo: vence em menos de 30 dias
  - Vermelho: vencida
- [ ] Atualizar `frontend/src/app/(private)/issuer/layout.tsx`

---

### FASE 3 — Regras de Negócio Completas

#### 3.1 Ao criar lote (POST /lots):
- [ ] Chamar função `conceder_licenca_bonus(org_id, lote_id)`
- [ ] Lógica: se org já tem licença ativa → estender; senão → criar nova

#### 3.2 Ao tentar assinar (POST /sign/prepare):
- [ ] Checar licença ativa → prosseguir
- [ ] Sem licença → 403 + info do plano

#### 3.3 Renovação manual (POST /licenca/renovar):
- [ ] Criar licença paid por 1 ano a partir de hoje
- [ ] Futuramente: integrar com gateway de pagamento (Stripe/Pagar.me)

---

### FASE 4 — Futuro (não implementar agora)
- [ ] Integração com gateway de pagamento (Pix + cartão)
- [ ] Checkout dentro da plataforma para comprar lotes
- [ ] Envio de email de aviso 30 dias antes da licença vencer
- [ ] Dashboard financeiro para o admin ver receita
- [ ] Suporte a cliente PF (sem CNPJ obrigatório)

---

## ARQUIVOS A CRIAR/MODIFICAR

| Arquivo | Ação |
|---|---|
| `backend/app/models/licenca_assinatura.py` | CRIAR |
| `backend/app/api/v1/endpoints/licenca.py` | CRIAR |
| `backend/app/api/v1/endpoints/lots.py` | MODIFICAR — conceder licença ao criar lote |
| `backend/app/api/v1/endpoints/sign.py` | MODIFICAR — validar licença antes de assinar |
| `backend/app/api/v1/router.py` | MODIFICAR — registrar endpoint licenca |
| `frontend/src/app/(private)/issuer/planos/page.tsx` | CRIAR |
| `frontend/src/app/(private)/issuer/sign/page.tsx` | MODIFICAR — mostrar status licença |
| `frontend/src/app/(private)/issuer/layout.tsx` | MODIFICAR — indicador licença no menu |

---

## CHECKLIST DE EXECUÇÃO

- [x] 1. Criar model LicencaAssinatura
- [x] 2. Criar endpoint GET/POST /licenca (status, renovar, admin/todas)
- [x] 3. Modificar lots.py — conceder/estender licença ao criar lote (+1 ano bonus)
- [x] 4. Modificar sign.py — validar licença ativa antes de assinar (403 licenca_inativa)
- [x] 5. Registrar router (/licenca)
- [x] 6. Criar página /issuer/planos (status licença + créditos dos lotes + botão renovar)
- [x] 7. Atualizar /issuer/sign — banner verde/amarelo/vermelho com link para planos
- [x] 8. Atualizar layout issuer — indicador 🟢/🟡/🔴 no menu + item Planos
- [x] 9. Commit + push (commit 88b670a)
