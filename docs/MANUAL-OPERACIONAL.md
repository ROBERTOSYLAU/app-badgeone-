# Manual Operacional - Badge One (Admin)

## 1. Acesso
- URL: `/login`
- Perfil administrador: gerencia organizações, lotes, credenciais e histórico.

## 2. Organizações
- Criar organização com nome manual ou via CNPJ.
- Status: Ativa, Pausada, Lixeira.
- Ações críticas pedem confirmação.

## 3. Lotes
- Criar lote com:
  - Nome do lote
  - Descrição
  - Quantidade total
- Ações possíveis:
  - Editar quantidade
  - Ativar/Pausar
  - Revogar
  - Enviar para Lixeira

## 4. Recuperação de lote
- Em Lotes revogados/lixeira, botão **Recuperar lote**.
- Fluxo de segurança:
  1. confirmação digitando `RECUPERAR`
  2. opção de ajustar quantidade no momento da recuperação

## 5. Histórico de ações
- Página de detalhe do lote mostra histórico com:
  - Ação executada
  - Data/hora
  - Detalhes do antes/depois

## 6. Credenciais emitidas
- Controle por status (válida, pausada, revogada, lixeira)
- Mudanças de status registradas para auditoria

## 7. Deploy seguro (resumo)
1. `git pull`
2. `docker compose up -d --build`
3. validar:
   - `git rev-parse --short HEAD`
   - `curl -I http://localhost`
   - `curl -I http://localhost/api/health`

## 8. Recuperação rápida em falha
- Verificar containers:
  - `docker compose ps -a`
- Logs:
  - `docker compose logs --tail=120 nginx`
  - `docker compose logs --tail=120 frontend`
  - `docker compose logs --tail=120 backend`
