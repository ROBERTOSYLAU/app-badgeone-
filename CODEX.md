# Instruções de IA do BadgeOne

Projeto: BadgeOne

Propósito:
O BadgeOne permite que organizações criem e emitam badges (credenciais digitais) para usuários.

Arquitetura principal:

Frontend
- React
- Painel administrativo
- Login de organizações

Backend
- API em Node.js
- Autenticação com JWT
- Endpoints para emissão de badges

Infraestrutura
- Docker
- Nginx como proxy reverso
- Banco de dados PostgreSQL

Principais pastas:

frontend/
Interface do usuário e painel administrativo.

backend/
Serviços da API, autenticação e emissão de badges.

docs/
Documentação do projeto.

nginx/
Configuração do proxy reverso.

Regras importantes para modificações feitas pela IA:

1. Não quebrar a configuração do Docker
2. Manter as rotas da API sob o prefixo /api
3. O frontend deve permanecer responsivo
4. A autenticação deve utilizar JWT

Objetivo:
Auxiliar no desenvolvimento da plataforma BadgeOne.
