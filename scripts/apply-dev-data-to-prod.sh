#!/bin/bash

# Apply development data to production database
# This script executes the migration SQL file on the production database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Applying development data to production..."
echo ""

# Check if migration file exists
if [ ! -f "$PROJECT_ROOT/scripts/migrate-dev-to-prod.sql" ]; then
  echo "Error: Migration file not found!"
  echo "Run: node scripts/export-dev-data.js first"
  exit 1
fi

# Load .env.production for credentials
if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
  echo "Error: .env.production not found!"
  exit 1
fi

set -a
source "$PROJECT_ROOT/.env.production"
set +a

# Confirm
echo "You are about to apply development data to production:"
echo "  Project: $SUPABASE_PROJECT_REF"
echo "  Records: 18 signals, 60 nuggets"
echo ""
read -p "Continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Cancelled"
  exit 0
fi

# Link to production
echo "Linking to production..."
supabase unlink 2>/dev/null || true
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

# Execute SQL file using psql via supabase CLI
echo ""
echo "Executing migration SQL..."

# Get connection string
DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Execute via psql (if available)
if command -v psql &> /dev/null; then
  psql "$DB_URL" -f "$PROJECT_ROOT/scripts/migrate-dev-to-prod.sql"
  echo ""
  echo "✓ Migration applied successfully!"
else
  echo "psql not found. Please use Supabase Studio SQL Editor instead:"
  echo "  1. Go to: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new"
  echo "  2. Copy contents of: scripts/migrate-dev-to-prod.sql"
  echo "  3. Paste and click 'Run'"
fi

echo ""
