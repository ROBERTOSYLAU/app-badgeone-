# App Badge One (SaaS)

Estrutura do app operacional separado da landing WordPress.

## Objetivo MVP
- Login Admin/Emissor
- Emissão de badges (individual + lote)
- Verificação pública
- Vitrine do ganhador com conquistas (inclusive de múltiplos emissores)

## Estrutura
- `frontend/` (Next.js, porta 3001)
- `backend/` (FastAPI, porta 8000)
- `docs/` documentação funcional/técnica

## Deploy recomendado (sem conflito de porta)

Subir tudo por Docker (frontend + backend + db + redis + nginx):

```bash
docker compose up -d --build
```

### Hardening de deploy (importante)

- Frontend roda em `3001`, então o Nginx deve apontar para `frontend:3001`.
- Use `DATABASE_URL` com `postgresql+psycopg://...` (não use `postgres://...`).
- Veja checklist rápido em `DEPLOY.md`.

Acesso local:
- App: `http://localhost`
- API health: `http://localhost/health`
- API docs (quando habilitar docs): `http://localhost/api/v1/...`

## Desenvolvimento local (opcional)
Se quiser rodar separado manualmente, pare os containers de frontend/backend antes para evitar conflito de porta.

## Rotas iniciais
- Frontend: `/login`, `/admin`, `/issuer`, `/verify/[id]`
- API: `/health`, `/api/v1/auth/seed-admin`, `/api/v1/auth/login`, `/api/v1/organizations`, `/api/v1/lots`, `/api/v1/credentials`
