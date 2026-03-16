#!/bin/bash
# Script de restore do banco de dados

set -e

BACKUP_DIR="./backups"

echo "🔄 Iniciando restore do banco de dados..."

# Lista backups disponíveis
echo "📋 Backups disponíveis:"
ls -lh $BACKUP_DIR/*.gz 2>/dev/null || {
    echo "❌ Nenhum backup encontrado em $BACKUP_DIR"
    exit 1
}

echo ""
echo "Digite o nome do arquivo de backup (ex: badgeone_backup_20240315_120000.sql.gz):"
read BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

# Confirmação
echo ""
echo "⚠️  ATENÇÃO: Isso vai substituir todos os dados atuais!"
echo "Digite 'RESTAURAR' para confirmar:"
read CONFIRM

if [ "$CONFIRM" != "RESTAURAR" ]; then
    echo "❌ Cancelado pelo usuário"
    exit 1
fi

# Verifica se o container está rodando
if ! docker ps | grep -q badgeone_postgres; then
    echo "❌ Erro: Container do PostgreSQL não está rodando!"
    exit 1
fi

echo "📦 Restaurando backup..."

# Descompacta e restaura
gunzip -c "$BACKUP_DIR/$BACKUP_FILE" | docker exec -i badgeone_postgres psql -U badgeone badgeone

echo "✅ Restore concluído com sucesso!"
