# Deploy Hardening (VPS)

Fluxo estável para "apertar botão e subir" sem quebrar:

## 1) Pré-requisitos fixos (uma vez)

- `docker-compose.yml` com:
  - `DATABASE_URL=postgresql+psycopg://...`
- `nginx/default.conf` com:
  - `proxy_pass http://frontend:3001/`

## 2) Deploy padrão

```bash
git pull
docker compose up -d --build
docker compose ps
```

## 3) Verificação rápida (30s)

```bash
curl -I http://localhost
curl -I http://localhost/api/health
```

Esperado:
- `localhost` -> `200` ou `301`
- `/api/health` -> `200`

## 4) Se der 502

```bash
docker compose ps -a
docker compose logs --tail=120 nginx
docker compose logs --tail=120 frontend
docker compose logs --tail=120 backend
```

## 5) Causa comum já corrigida

- Porta do frontend no Nginx (`3000` errado -> `3001` certo)
- `DATABASE_URL` com prefixo antigo (`postgres://`) em vez de `postgresql+psycopg://`
