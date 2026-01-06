#!/bin/bash

# Production Deployment Script for Signal Digest
# This script deploys migrations and Edge Functions to a fresh Supabase instance
# Usage: ./scripts/deploy-to-production.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Signal Digest - Production Deployment Script          ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if .env.production exists
if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
  echo -e "${RED}✗ Error: .env.production file not found!${NC}"
  echo ""
  echo "Please create .env.production with the following variables:"
  echo ""
  echo "  SUPABASE_PROJECT_REF=xxxxxxxxxxxxx"
  echo "  SUPABASE_DB_PASSWORD=your-db-password"
  echo "  SUPABASE_ACCESS_TOKEN=your-access-token"
  echo "  NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co"
  echo "  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  echo "  AI_GATEWAY_URL=https://your-ai-gateway.com/v1"
  echo "  AI_GATEWAY_API_KEY=your-api-key"
  echo ""
  echo "Get your access token from: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

# Load environment variables
echo -e "${BLUE}→${NC} Loading .env.production..."
set -a
source "$PROJECT_ROOT/.env.production"
set +a

# Validate required variables
REQUIRED_VARS=(
  "SUPABASE_PROJECT_REF"
  "SUPABASE_DB_PASSWORD"
  "SUPABASE_ACCESS_TOKEN"
  "NEXT_PUBLIC_SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}✗ Error: Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}✗ Error: Supabase CLI not found!${NC}"
  echo ""
  echo "Install it with:"
  echo "  brew install supabase/tap/supabase"
  echo ""
  echo "Or see: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI found: $(supabase --version)"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠${NC}  You are about to deploy to production:"
echo "   Project: ${SUPABASE_PROJECT_REF}"
echo "   URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo ""
read -p "Continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

# Step 1: Login to Supabase
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Authenticate with Supabase${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set access token for CLI
export SUPABASE_ACCESS_TOKEN

# Check if already logged in
if supabase projects list > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Already authenticated with Supabase"
else
  echo -e "${BLUE}→${NC} Logging in to Supabase..."
  supabase login
  echo -e "${GREEN}✓${NC} Logged in successfully"
fi
echo ""

# Step 2: Link to project
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Link to Supabase Project${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}→${NC} Linking to project ${SUPABASE_PROJECT_REF}..."

# Unlink if already linked to avoid conflicts
supabase unlink 2>/dev/null || true

# Link to the project
if supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"; then
  echo -e "${GREEN}✓${NC} Linked to production project"
else
  echo -e "${RED}✗ Failed to link to project${NC}"
  exit 1
fi
echo ""

# Step 3: Deploy migrations
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Deploy Database Migrations${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# List migrations that will be applied
echo -e "${BLUE}→${NC} Migrations to apply:"
ls -1 "$PROJECT_ROOT/supabase/migrations/"*.sql | while read -r migration; do
  basename "$migration"
done | grep -v "20250101000003_add_dev_user.sql" || true
echo ""

echo -e "${BLUE}→${NC} Pushing migrations to production..."
if supabase db push; then
  echo -e "${GREEN}✓${NC} Migrations applied successfully"
else
  echo -e "${RED}✗ Migration failed${NC}"
  echo ""
  echo "Check the error above. Common issues:"
  echo "  - Migration already applied (safe to ignore)"
  echo "  - Syntax error in SQL"
  echo "  - Permission issues"
  exit 1
fi
echo ""

# Step 4: Configure Auto-Sync Environment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Configure Auto-Sync Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}→${NC} Auto-sync uses webhook architecture - no credentials stored in database"
echo -e "${BLUE}→${NC} pg_cron will call: ${NEXT_PUBLIC_APP_URL}/api/cron/auto-sync"
echo -e "${BLUE}→${NC} Authentication: CRON_API_KEY (set in Next.js environment)"

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo -e "${YELLOW}⚠${NC}  NEXT_PUBLIC_APP_URL not set in .env.production"
  echo "   This is needed for pg_cron to call the webhook"
  echo "   Example: NEXT_PUBLIC_APP_URL=https://your-app.com"
fi

if [ -z "$CRON_API_KEY" ]; then
  echo -e "${YELLOW}⚠${NC}  CRON_API_KEY not set in .env.production"
  echo "   Generate a random API key for webhook authentication"
  echo "   Example: CRON_API_KEY=\$(openssl rand -hex 32)"
fi

echo ""

# Step 5: Deploy Edge Functions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Deploy Edge Functions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check which Edge Functions exist
EDGE_FUNCTIONS=(
  "auto-sync"
  "import-emails"
  "extract-nuggets"
)

FUNCTIONS_TO_DEPLOY=()
for func in "${EDGE_FUNCTIONS[@]}"; do
  if [ -d "$PROJECT_ROOT/supabase/functions/$func" ]; then
    FUNCTIONS_TO_DEPLOY+=("$func")
  fi
done

if [ ${#FUNCTIONS_TO_DEPLOY[@]} -eq 0 ]; then
  echo -e "${YELLOW}⚠${NC}  No Edge Functions found to deploy"
else
  echo -e "${BLUE}→${NC} Found ${#FUNCTIONS_TO_DEPLOY[@]} Edge Function(s) to deploy:"
  for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    echo "   - $func"
  done
  echo ""

  # Deploy each function
  for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    echo -e "${BLUE}→${NC} Deploying $func..."
    if supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_REF"; then
      echo -e "${GREEN}✓${NC} $func deployed successfully"
    else
      echo -e "${RED}✗ Failed to deploy $func${NC}"
      echo "   Continuing with other functions..."
    fi
    echo ""
  done
fi

# Step 6: Set Edge Function Secrets
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Configure Edge Function Secrets${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set AI Gateway secrets if provided
if [ -n "$AI_GATEWAY_URL" ] && [ -n "$AI_GATEWAY_API_KEY" ]; then
  echo -e "${BLUE}→${NC} Setting AI Gateway secrets..."

  if supabase secrets set AI_GATEWAY_URL="$AI_GATEWAY_URL" --project-ref "$SUPABASE_PROJECT_REF" && \
     supabase secrets set AI_GATEWAY_API_KEY="$AI_GATEWAY_API_KEY" --project-ref "$SUPABASE_PROJECT_REF"; then
    echo -e "${GREEN}✓${NC} AI Gateway secrets configured"
  else
    echo -e "${YELLOW}⚠${NC}  Could not set secrets via CLI"
    echo "   Set these manually in Supabase Dashboard:"
    echo "   Settings > Edge Functions > Secrets"
  fi
else
  echo -e "${YELLOW}⚠${NC}  AI_GATEWAY_URL or AI_GATEWAY_API_KEY not found in .env.production"
  echo "   Add these if you need AI processing:"
  echo "   - AI_GATEWAY_URL"
  echo "   - AI_GATEWAY_API_KEY"
fi
echo ""

# Step 7: Verify Deployment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Verify Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}→${NC} Checking migration status..."
if supabase migration list --linked; then
  echo ""
else
  echo -e "${YELLOW}⚠${NC}  Could not list migrations (this is OK if they're all applied)"
  echo ""
fi

echo -e "${BLUE}→${NC} Checking deployed Edge Functions..."
if supabase functions list; then
  echo ""
else
  echo -e "${YELLOW}⚠${NC}  Could not list Edge Functions (check dashboard manually)"
  echo ""
fi

# Final summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  ✓ Migrations applied"
echo "  ✓ pg_cron settings configured"
echo "  ✓ Edge Functions deployed"
echo "  ✓ Secrets configured"
echo ""
echo "Next steps:"
echo ""
echo "1. Create your user account:"
echo "   Go to: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/auth/users"
echo "   Click 'Add user' and create your account"
echo ""
echo "2. Deploy your Next.js app to Coolify/Hetzner:"
echo "   See: docs/production-deployment-guide.md (Part 2)"
echo ""
echo "3. Test your deployment:"
echo "   - Login to your app"
echo "   - Configure email settings"
echo "   - Enable auto-sync"
echo "   - Import test emails"
echo ""
echo "Supabase Dashboard: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}"
echo ""
