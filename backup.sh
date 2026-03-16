#!/bin/bash
# Script de backup do banco de dados

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="badgeone_backup_$DATE.sql"

echo "💾 Iniciando backup do banco de dados..."

# Cria diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Verifica se o container está rodando
if ! docker ps | grep -q badgeone_postgres; then
    echo "❌ Erro: Container do PostgreSQL não está rodando!"
    echo "💡 Dica: Inicie o sistema primeiro com: docker compose up -d"
    exit 1
fi

# Faz o backup
echo "📦 Exportando dados..."
docker exec badgeone_postgres pg_dump -U badgeone badgeone > "$BACKUP_DIR/$BACKUP_FILE"

# Compacta o backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

echo "✅ Backup concluído: $BACKUP_DIR/${BACKUP_FILE}.gz"

# Lista backups existentes
echo ""
echo "📋 Backups disponíveis:"
ls -lh $BACKUP_DIR/*.gz 2>/dev/null || echo "Nenhum backup encontrado"

# Remove backups antigos (mantém últimos 10)
echo ""
echo "🧹 Limpando backups antigos..."
cd $BACKUP_DIR && ls -t *.gz 2>/dev/null | tail -n +11 | xargs -r rm --

echo "🎉 Backup finalizado com sucesso!"
