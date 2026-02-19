# Publicação no GitHub e execução local

## Repositório sugerido
- `badgeone-wp-theme` (landing WP)
- `app-badgeone` (SaaS)

## O que subir agora
### Landing
- pasta `landingpage/` (ou direto `badgeone-wp-theme/`)
- arquivo zip opcional: `badgeone-wp-theme.zip`

### App SaaS
- pasta completa `app-badgeone/`

## Run local rápido
```bash
cd app-badgeone
docker compose up -d
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Outro terminal:
```bash
cd app-badgeone/frontend
npm install
npm run dev
```

## Bootstrap admin
```bash
curl -X POST http://localhost:8000/api/v1/auth/seed-admin -H "Content-Type: application/json" -d "{\"email\":\"admin@badgeone.com.br\",\"password\":\"Admin@123\",\"name\":\"Admin\"}"
```
