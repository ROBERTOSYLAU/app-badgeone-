#!/bin/bash
# Script to run database migration

echo "🔄 Running database migration..."

# Execute migration SQL inside PostgreSQL container
docker exec -i badgeone_postgres psql -U badgeone -d badgeone < backend/migrations/migration.sql

echo "✅ Migration completed!"
