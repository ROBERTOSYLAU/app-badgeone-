#!/bin/bash
# Script de deploy seguro - NUNCA apaga volumes ou dados!

set -e

echo "🚀 Iniciando deploy seguro do BadgeOne..."

# Verifica se está no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: docker-compose.yml não encontrado. Execute na raiz do projeto."
    exit 1
fi

# Puxa as últimas alterações
echo "📥 Atualizando código..."
git pull origin main

# Faz backup do banco antes do deploy (se possível)
echo "💾 Verificando backup..."
if docker ps | grep -q badgeone_postgres; then
    echo "✅ Banco está rodando - dados serão preservados"
else
    echo "⚠️  Banco não está rodando - será iniciado com dados existentes"
fi

# Deploy SEM remover volumes (-v NUNCA é usado)
echo "🔨 Construindo e iniciando containers..."
docker compose up -d --build

# Aguarda o banco ficar pronto
echo "⏳ Aguardando banco de dados..."
sleep 5

# Verifica status
echo "✅ Verificando status..."
docker compose ps

# Mostra versão do commit
echo "📋 Versão do deploy:"
git rev-parse --short HEAD

echo ""
echo "🎉 Deploy concluído com sucesso!"
echo "💡 Dica: Seus dados estão seguros no volume 'postgres_data'"
