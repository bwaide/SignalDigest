# Deployment Script Usage Guide

**Quick Start:** Automated deployment of Signal Digest to Supabase production

---

## Overview

The deployment script (`scripts/deploy-to-production.sh`) automates:
1. Authentication with Supabase
2. Database migration deployment
3. pg_cron configuration for auto-sync
4. Edge Function deployment
5. Secret configuration
6. Deployment verification

**Time:** ~5 minutes (vs 30 minutes manual)

---

## Prerequisites

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
brew install supabase/tap/supabase

# Windows (WSL)
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### 2. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name:** `signal-digest-production`
   - **Database Password:** (save this - you'll need it)
   - **Region:** Choose closest to you
4. Wait for provisioning (~2 minutes)

### 3. Get Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Name: `deployment-script`
4. Copy the token (starts with `sbp_`)

### 4. Gather Required Credentials

From **Supabase Dashboard > Settings > API:**
- Project Reference ID (in URL: `supabase.com/dashboard/project/xxxxxxxxxxxxx`)
- Supabase URL (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
- Anon Key (public key)
- Service Role Key (secret key - keep safe!)

From **Supabase Dashboard > Settings > Database:**
- Database Password (the one you set during project creation)

---

## Setup Instructions

### Step 1: Create `.env.production` File

```bash
# Copy the example file
cp .env.production.example .env.production

# Edit with your credentials
nano .env.production
```

**Required variables:**
```bash
SUPABASE_PROJECT_REF=xxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Optional (for AI features):**
```bash
AI_GATEWAY_URL=https://your-ai-gateway.com/v1
AI_GATEWAY_API_KEY=your-api-key-here
```

### Step 2: Run Deployment Script

```bash
# Make sure you're in the project root
cd /path/to/signal-digest

# Run the deployment script
./scripts/deploy-to-production.sh
```

### Step 3: Follow Prompts

The script will:
1. ✓ Validate environment variables
2. ✓ Check Supabase CLI installation
3. ⚠️ **Ask for confirmation** before deploying
4. ✓ Login to Supabase
5. ✓ Link to your project
6. ✓ Push migrations
7. ✓ Configure pg_cron settings
8. ✓ Deploy Edge Functions
9. ✓ Set secrets
10. ✓ Verify deployment

**Example output:**
```
╔══════════════════════════════════════════════════════════╗
║   Signal Digest - Production Deployment Script          ║
╔══════════════════════════════════════════════════════════╗

→ Loading .env.production...
✓ Environment variables loaded

✓ Supabase CLI found: 1.123.4

⚠  You are about to deploy to production:
   Project: abcdefghijklmnop
   URL: https://abcdefghijklmnop.supabase.co

Continue? (yes/no): yes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: Authenticate with Supabase
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Already authenticated with Supabase

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2: Link to Supabase Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Linking to project abcdefghijklmnop...
✓ Linked to production project

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3: Deploy Database Migrations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Migrations to apply:
20250101000001_initial_schema.sql
20250101000002_add_signal_sources.sql
20250101000004_vault_wrappers.sql
...

✓ Migrations applied successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4: Configure Auto-Sync Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Setting auto-sync configuration in database...
✓ Auto-sync configuration saved to database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: Deploy Edge Functions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Found 3 Edge Function(s) to deploy:
   - auto-sync
   - import-emails
   - extract-nuggets

→ Deploying auto-sync...
✓ auto-sync deployed successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Deployment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## What Gets Deployed

### Database Migrations (7 files)
- ✅ `initial_schema.sql` - Core tables (signals, nuggets, user_settings)
- ✅ `add_signal_sources.sql` - Signal source tracking
- ✅ `vault_wrappers.sql` - Secure password storage
- ✅ `add_topic_taxonomy.sql` - Topic categorization
- ✅ `add_nugget_status_field.sql` - Inbox/saved/archive
- ✅ `add_auto_sync_settings.sql` - Auto-sync configuration
- ✅ `enable_pg_cron_for_auto_sync.sql` - Server-side auto-sync (pg_cron webhook architecture)
- ❌ `add_dev_user.sql` - **SKIPPED** (dev-only)

### Edge Functions (3 functions)
- ✅ `auto-sync` - Triggered by pg_cron for scheduled imports
- ✅ `import-emails` - IMAP email import logic
- ✅ `extract-nuggets` - AI-powered nugget extraction

### Configuration
- ✅ Auto-sync webhook architecture (pg_cron calls Next.js API with API key)
- ✅ Next.js environment variables (CRON_API_KEY, NEXT_PUBLIC_APP_URL)
- ✅ Edge Function secrets (AI Gateway credentials)

---

## Post-Deployment Steps

### 1. Create Your User Account

**Option A: Via Supabase Dashboard**
1. Go to `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/users`
2. Click **"Add user"**
3. Enter your email and password
4. Click **"Create user"**

**Option B: Via SQL Editor**
```sql
-- This creates a user and sends a confirmation email
SELECT auth.signup('your@email.com', 'your-secure-password');
```

**Save your User ID** - you'll need it for testing

### 2. Verify Deployment

**Check migrations:**
```bash
supabase migration list --project-ref YOUR_PROJECT_REF
```

**Check Edge Functions:**
```bash
supabase functions list --project-ref YOUR_PROJECT_REF
```

**Test database connection:**
```bash
psql "postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
```

### 3. Deploy Next.js App

Now deploy your Next.js app to Coolify/Hetzner:
- See: `docs/production-deployment-guide.md` (Part 2)
- Use the same credentials from `.env.production`

---

## Troubleshooting

### Error: "Migration already applied"
**Cause:** Migrations were previously applied
**Fix:** This is safe to ignore. The script detects and skips existing migrations.

### Error: "Could not link to project"
**Cause:** Invalid credentials or project doesn't exist
**Fix:**
1. Verify `SUPABASE_PROJECT_REF` is correct
2. Verify `SUPABASE_DB_PASSWORD` is correct
3. Check project exists in dashboard

### Error: "Permission denied"
**Cause:** Access token doesn't have required permissions
**Fix:**
1. Generate a new access token at https://supabase.com/dashboard/account/tokens
2. Update `SUPABASE_ACCESS_TOKEN` in `.env.production`
3. Run script again

### Error: "Function deployment failed"
**Cause:** Edge Function has syntax errors or missing dependencies
**Fix:**
1. Check function code in `supabase/functions/<function-name>/`
2. Test locally: `supabase functions serve <function-name>`
3. Fix errors and re-run deployment script

### Error: "NEXT_PUBLIC_APP_URL not set"
**Cause:** Missing environment variable for webhook URL
**Fix:**
1. Add to `.env.production`:
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-app.com
   CRON_API_KEY=$(openssl rand -hex 32)
   ```
2. Also set in Coolify environment variables
3. Re-run deployment script

---

## Manual Deployment (If Script Fails)

If the script doesn't work, follow the manual steps:

### 1. Login
```bash
supabase login
```

### 2. Link Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Push Migrations
```bash
supabase db push
```

### 4. Configure Auto-Sync
Set environment variables in Coolify:
```bash
NEXT_PUBLIC_APP_URL=https://your-app.com
CRON_API_KEY=your-random-api-key-here
```

The pg_cron jobs will be created automatically when users enable auto-sync in the app.

### 5. Deploy Edge Functions
```bash
supabase functions deploy auto-sync --project-ref YOUR_PROJECT_REF
supabase functions deploy import-emails --project-ref YOUR_PROJECT_REF
supabase functions deploy extract-nuggets --project-ref YOUR_PROJECT_REF
```

### 6. Set Secrets
```bash
supabase secrets set AI_GATEWAY_URL="https://your-ai-gateway.com/v1" --project-ref YOUR_PROJECT_REF
supabase secrets set AI_GATEWAY_API_KEY="your-api-key" --project-ref YOUR_PROJECT_REF
```

---

## Security Notes

### `.env.production` Security
- ✅ `.env.production` is in `.gitignore`
- ⚠️ **NEVER commit this file to git**
- ⚠️ Contains sensitive credentials (service role key)
- ✅ Safe to keep on your local machine
- ✅ Add to password manager for backup

### Service Role Key
- ⚠️ Has full database access (bypasses RLS)
- ⚠️ Never expose to client-side code
- ✅ Only used in server-side code and Edge Functions
- ✅ Rotated via Supabase Dashboard if compromised

### Access Token
- ⚠️ Used by CLI to access Supabase API
- ⚠️ Can create/delete projects, read data
- ✅ Revocable at https://supabase.com/dashboard/account/tokens
- ✅ Expires after 30 days (can be refreshed)

---

## Quick Reference

### Run Deployment
```bash
./scripts/deploy-to-production.sh
```

### Check Status
```bash
# Migration status
supabase migration list --project-ref YOUR_PROJECT_REF

# Edge Functions status
supabase functions list --project-ref YOUR_PROJECT_REF

# Database tables
psql "YOUR_DB_CONNECTION_STRING" -c "\dt"
```

### Re-deploy After Changes
```bash
# Re-run the script - it's idempotent
./scripts/deploy-to-production.sh

# Or deploy specific parts:
supabase db push  # Migrations only
supabase functions deploy auto-sync  # Single function
```

### View Logs
```bash
# Edge Function logs
supabase functions logs auto-sync --project-ref YOUR_PROJECT_REF

# Database logs
# Go to Supabase Dashboard > Logs
```

---

## Next Steps

After successful deployment:

1. ✅ Create your user account
2. ✅ Deploy Next.js app to Coolify (Part 2 of deployment guide)
3. ✅ Login to your app
4. ✅ Configure email IMAP settings
5. ✅ Enable auto-sync
6. ✅ Import test emails
7. ✅ Verify everything works

**Full guide:** `docs/production-deployment-guide.md`

---

**Questions?** Check the troubleshooting section or manual deployment steps above.
