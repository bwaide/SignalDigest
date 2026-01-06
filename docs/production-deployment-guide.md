# Production Deployment Guide

**Date:** January 5, 2026
**Target:** Fresh Supabase cloud instance + Coolify/Nixpacks on Hetzner
**Status:** Ready for Production MVP

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Hetzner server with Coolify installed
- [ ] Domain name (e.g., `signaldigest.com`)
- [ ] DNS access to create A/CNAME records
- [ ] Gmail/IMAP email account for imports
- [ ] OpenAI API key (or AI Gateway URL + API key)
- [ ] GitHub repository with your code

---

## Part 1: Supabase Cloud Setup (30 minutes)

### Step 1: Create Supabase Project

1. **Go to https://supabase.com/dashboard**
2. Click **"New Project"**
3. Fill in:
   - **Name:** `signal-digest-production`
   - **Database Password:** Generate strong password (save in password manager)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier is fine for MVP
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

### Step 2: Save Important Credentials

Once project is ready, go to **Settings > API**:

```bash
# Save these values - you'll need them later
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ⚠️ Keep secret!
SUPABASE_DB_PASSWORD=<password-you-set>
```

Go to **Settings > Database** and note:
```bash
SUPABASE_DB_CONNECTION_STRING=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Step 3: Configure Authentication

**Settings > Authentication > URL Configuration:**
```
Site URL: https://yourdomain.com
Redirect URLs: https://yourdomain.com/auth/callback
```

**Settings > Authentication > Email Auth:**
- ✅ Enable email confirmations (optional - disable for faster testing)
- ✅ Enable email/password sign-ins
- ✅ Disable email confirmations for faster onboarding (you can enable later)

**Settings > Authentication > Providers:**
- ✅ Email (already enabled)
- Add OAuth providers if needed (Google, GitHub, etc.) - optional

### Step 4: Run Database Migrations

**Option A: Via Supabase CLI (Recommended)**

```bash
# Install Supabase CLI if not already installed
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxx

# Push all migrations
supabase db push

# Verify migrations applied
supabase migration list
```

**Option B: Manual SQL Execution**

Go to **SQL Editor** in Supabase Dashboard and run each migration file in order:

1. `20250101000001_initial_schema.sql`
2. `20250101000002_add_signal_sources.sql`
3. `20250101000004_vault_wrappers.sql`
4. `20250101000005_add_topic_taxonomy.sql`
5. `20260104161730_add_nugget_status_field.sql`
6. `20260104205311_add_auto_sync_settings.sql`
7. `20260105164704_enable_pg_cron_for_auto_sync.sql`

**⚠️ SKIP:** `20250101000003_add_dev_user.sql` (dev-only migration)

### Step 5: Create Your User Account

**Via Supabase Dashboard:**
1. Go to **Authentication > Users**
2. Click **"Add user"**
3. Enter your email and password
4. Click **"Create user"**
5. **Save your User ID** - you'll need it

**Or via SQL Editor:**
```sql
-- This will send a confirmation email
SELECT auth.signup('your@email.com', 'your-secure-password');
```

### Step 6: Deploy Edge Functions

```bash
# Deploy auto-sync function
supabase functions deploy auto-sync

# Deploy import-emails function (if you have it)
supabase functions deploy import-emails

# Deploy extract-nuggets function (if you have it)
supabase functions deploy extract-nuggets
```

**Set Edge Function secrets:**
```bash
# Set AI Gateway credentials
supabase secrets set AI_GATEWAY_URL=https://your-ai-gateway.com
supabase secrets set AI_GATEWAY_API_KEY=your-api-key

# Secrets are automatically available as env vars in Edge Functions
```

### Step 7: Configure pg_cron Settings

Run in **SQL Editor**:

```sql
-- Set Supabase URL for pg_cron HTTP calls
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xxxxxxxxxxxxx.supabase.co';

-- Set service role key for pg_cron authentication
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Verify settings:**
```sql
SELECT current_setting('app.settings.supabase_url');
SELECT current_setting('app.settings.service_role_key');
```

### Step 8: Test Database Connection

```bash
# Test connection from your local machine
psql "postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres"

# Verify tables exist
\dt

# Should see: signals, nuggets, user_settings, auto_sync_jobs, etc.
```

---

## Part 2: Coolify/Hetzner Setup (45 minutes)

### Step 1: Prepare Your Repository

**Ensure your `.gitignore` includes:**
```
.env.local
.env*.local
.env.production
.DS_Store
node_modules/
.next/
```

**Create `.env.example` (safe to commit):**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Gateway
AI_GATEWAY_URL=
AI_GATEWAY_API_KEY=

# App Config
NODE_ENV=production
```

**Commit and push to GitHub:**
```bash
git add .
git commit -m "chore: prepare for production deployment"
git push origin main
```

### Step 2: Create Coolify Application

1. **Login to Coolify Dashboard**
2. Click **"+ New Resource"** > **"Application"**
3. **Select Source:**
   - Choose **"Public Repository"**
   - Paste your GitHub URL: `https://github.com/yourusername/signal-digest`
4. **Configure Application:**
   - **Name:** `signal-digest`
   - **Build Pack:** Nixpacks (auto-detected for Next.js)
   - **Branch:** `main`
   - **Port:** `3000`
5. Click **"Create"**

### Step 3: Configure Environment Variables

In Coolify app settings, go to **"Environment Variables"** and add:

```bash
# Supabase (from Part 1, Step 2)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Gateway
AI_GATEWAY_URL=https://your-ai-gateway.com/v1
AI_GATEWAY_API_KEY=your-api-key-here

# App Config
NODE_ENV=production
```

**⚠️ Important:** Mark `SUPABASE_SERVICE_ROLE_KEY` and `AI_GATEWAY_API_KEY` as **"Build-time Secret"**

### Step 4: Configure Build Settings

**Build Command:** (usually auto-detected)
```bash
npm run build
```

**Start Command:** (usually auto-detected)
```bash
npm start
```

**Health Check:**
- **Path:** `/`
- **Port:** `3000`
- **Expected Status:** `200`

### Step 5: Set Up Domain

**In Coolify:**
1. Go to **"Domains"**
2. Add your domain: `signaldigest.com`
3. Enable **"Generate SSL Certificate"** (automatic Let's Encrypt)

**In your DNS provider:**
```
Type: A
Name: @
Value: <your-hetzner-ip>
TTL: 300

Type: CNAME
Name: www
Value: signaldigest.com
TTL: 300
```

**Wait for DNS propagation** (5-30 minutes):
```bash
# Check DNS
dig signaldigest.com

# Should return your Hetzner IP
```

### Step 6: Deploy Application

1. Click **"Deploy"** in Coolify
2. Watch build logs for errors
3. Wait for deployment to complete (~3-5 minutes)
4. Once deployed, click **"Open Application"**

**Common build issues:**
- **Missing env vars:** Check environment variables are set
- **Build timeout:** Increase timeout in Coolify settings
- **Port mismatch:** Ensure Next.js runs on port 3000

### Step 7: Verify Deployment

**Test the following:**

1. **Home Page:**
   ```bash
   curl -I https://signaldigest.com
   # Should return: HTTP/2 200
   ```

2. **Login Page:**
   - Visit `https://signaldigest.com/auth/login`
   - Try logging in with your Supabase user credentials
   - Should redirect to dashboard

3. **API Health:**
   ```bash
   # Test authenticated endpoint (should return 401)
   curl https://signaldigest.com/api/signals/list
   # Expected: {"success":false,"error":"Unauthorized"}
   ```

4. **SSL Certificate:**
   - Visit `https://signaldigest.com`
   - Check for green padlock
   - Certificate should be valid (Let's Encrypt)

---

## Part 3: Post-Deployment Configuration (20 minutes)

### Step 1: Configure Email Settings

**Login to your app:**
1. Go to `https://signaldigest.com/auth/login`
2. Login with your Supabase credentials
3. Click **Settings** (or navigate to settings page)

**Add Email Configuration:**
- **IMAP Host:** `imap.gmail.com` (or your provider)
- **Port:** `993`
- **Username:** `your@email.com`
- **Password:** (stored securely in Supabase Vault)
- **Use TLS:** ✅ Enabled
- **Archive Folder:** `[Gmail]/All Mail` (optional)

**Test Connection:**
- Click **"Test Connection"**
- Should see: "Connection successful"

### Step 2: Enable Auto-Sync

**In Settings > Auto-Sync:**
- **Enable Auto-Sync:** ✅
- **Interval:** `30 minutes` (or your preference)
- Click **"Save"**

**Verify pg_cron job created:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM cron.job WHERE jobname LIKE 'auto-sync-%';

-- Should show your scheduled job
```

**Manually trigger auto-sync to test:**
```sql
SELECT public.trigger_auto_sync('<your-user-id>');

-- Check for NOTICE in logs
```

### Step 3: Import Initial Emails

**Option A: Via UI**
1. Go to dashboard
2. Click **"Import Emails"** button
3. Wait for import to complete
4. Click **"Process Signals"** to extract nuggets

**Option B: Via API**
```bash
# Get your auth token from browser DevTools (Application > Cookies)
TOKEN="<your-supabase-access-token>"

# Import emails
curl -X POST https://signaldigest.com/api/emails/import \
  -H "Cookie: sb-access-token=$TOKEN"

# Process signals
curl -X POST https://signaldigest.com/api/signals/process \
  -H "Cookie: sb-access-token=$TOKEN"
```

### Step 4: Verify Everything Works

**Checklist:**
- [ ] Login works
- [ ] Email import works
- [ ] Signal processing works (nuggets created)
- [ ] Nuggets display in dashboard
- [ ] Status changes work (save/archive)
- [ ] Auto-sync is scheduled
- [ ] SSL certificate is valid
- [ ] Rate limiting is active

---

## Part 4: Monitoring & Maintenance

### Monitor Auto-Sync Jobs

**Check cron job status:**
```sql
-- View all auto-sync jobs
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'auto-sync-%')
ORDER BY start_time DESC
LIMIT 10;

-- Check for failures
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
AND jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'auto-sync-%');
```

### Monitor Rate Limits

**Check Coolify logs:**
```bash
# In Coolify, go to "Logs" and search for:
"Rate limit exceeded"

# Should be minimal if you're the only user
```

### Monitor Database Usage

**Supabase Dashboard > Database:**
- Check **Database Size** (should stay well under 500MB on free tier)
- Check **Active Connections** (should be < 20 for single user)
- Check **Query Performance**

### Backup Strategy

**Supabase automatically backs up your database daily (free tier)**

**For extra safety, create manual backups:**
```bash
# Backup database
pg_dump "postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres" \
  > backup-$(date +%Y%m%d).sql

# Restore if needed
psql "postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres" \
  < backup-20260105.sql
```

---

## Troubleshooting

### Issue: "502 Bad Gateway"
**Cause:** Next.js app not starting
**Fix:**
1. Check Coolify logs for errors
2. Verify environment variables are set
3. Check build succeeded
4. Restart deployment

### Issue: "Unauthorized" on all API calls
**Cause:** Authentication not working
**Fix:**
1. Verify Supabase URL/keys are correct
2. Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Clear browser cookies and re-login
4. Check Supabase auth settings

### Issue: Auto-sync not running
**Cause:** pg_cron not configured or job not created
**Fix:**
```sql
-- Check if pg_cron extension exists
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if jobs are scheduled
SELECT * FROM cron.job;

-- Check database settings
SELECT current_setting('app.settings.supabase_url');
SELECT current_setting('app.settings.service_role_key');

-- Recreate job if missing
SELECT public.schedule_auto_sync('<your-user-id>', 30);
```

### Issue: Email import fails
**Cause:** IMAP credentials incorrect or Vault access issue
**Fix:**
1. Re-enter IMAP password in settings
2. Test connection
3. Check Supabase logs for Vault errors
4. Verify service role key is set correctly

### Issue: Rate limit hit too frequently
**Cause:** You're testing heavily or have a buggy script
**Fix:**
```typescript
// In your local dev environment, disable rate limiting:
// lib/simple-rate-limit.ts - temporarily increase limits
emailImport: (userId: string) =>
  rateLimiter.check(`email-import:${userId}`, 1000, 60 * 60 * 1000), // 1000/hour for testing

// Remember to reset to 30/hour for production
```

---

## Security Hardening (Post-Launch)

### Enable Email Confirmations
**Supabase > Authentication > Email Auth:**
- ✅ Enable email confirmations
- ✅ Require email verification before login

### Set Up SMTP (Production Email)
**Supabase > Settings > Authentication > Email Auth > SMTP:**
```
Host: smtp.sendgrid.net
Port: 587
User: apikey
Password: <your-sendgrid-api-key>
Sender Email: noreply@yourdomain.com
```

### Enable Supabase Logs
**Supabase > Settings > Logging:**
- ✅ Enable API logs
- ✅ Enable Auth logs
- ✅ Enable Database logs

### Add Error Monitoring (Future)
When ready, add Sentry:
```bash
npm install @sentry/nextjs

# Add to next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

# Deploy with error tracking
```

---

## Cost Estimates

### Free Tier (Should be sufficient for MVP)

**Supabase Free:**
- Database: 500 MB
- API requests: Unlimited
- Auth users: Unlimited
- Edge Functions: 500,000 invocations/month
- **Cost:** $0/month

**Hetzner Server (via Coolify):**
- CPX11: 2 vCPU, 2GB RAM, 40GB SSD
- **Cost:** ~€5/month (~$5.50/month)

**OpenAI API:**
- gpt-4o-mini: $0.150/1M input tokens, $0.600/1M output tokens
- Estimated: 100 emails/day × 2000 tokens = $0.03/day
- **Cost:** ~$1/month

**Total MVP Cost:** ~$6.50/month

### When You'll Need to Upgrade

**Supabase Pro ($25/month) needed when:**
- [ ] Database > 500 MB
- [ ] Need daily backups
- [ ] Want advanced logs/analytics
- [ ] Add more users

**Bigger Hetzner Server needed when:**
- [ ] CPU consistently > 80%
- [ ] RAM consistently > 1.8GB
- [ ] Multiple concurrent users

---

## Launch Checklist

Before announcing your app:

- [ ] All migrations applied to production database
- [ ] User account created and can login
- [ ] Email import tested and working
- [ ] Signal processing tested and working
- [ ] Auto-sync scheduled and verified
- [ ] SSL certificate valid
- [ ] Rate limiting active
- [ ] Domain configured correctly
- [ ] Backups configured (Supabase automatic)
- [ ] Environment variables verified
- [ ] Test all critical user flows
- [ ] Check Supabase logs for errors
- [ ] Check Coolify logs for errors

---

## Quick Reference Commands

### Supabase CLI
```bash
# Link project
supabase link --project-ref xxxxxxxxxxxxx

# Push migrations
supabase db push

# Deploy edge function
supabase functions deploy auto-sync

# View logs
supabase functions logs auto-sync

# Set secrets
supabase secrets set KEY=value
```

### Coolify
```bash
# View logs
coolify logs <app-id>

# Restart app
coolify restart <app-id>

# Rebuild
coolify deploy <app-id>
```

### Database
```bash
# Connect to production DB
psql "postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres"

# Backup
pg_dump <connection-string> > backup.sql

# Restore
psql <connection-string> < backup.sql
```

---

## Support & Resources

**Supabase:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- Status: https://status.supabase.com

**Coolify:**
- Dashboard: https://your-server.com
- Docs: https://coolify.io/docs
- Discord: https://coolify.io/discord

**Your App:**
- Production: https://signaldigest.com
- GitHub: https://github.com/yourusername/signal-digest
- Supabase Project: https://supabase.com/dashboard/project/xxxxxxxxxxxxx

---

**Deployment Complete!** 🎉

Your Signal Digest app is now running in production on Supabase + Coolify/Hetzner.

**Next steps:**
1. Use the app daily to test stability
2. Monitor logs for any errors
3. Add error monitoring (Sentry) when ready
4. Consider adding more OAuth providers
5. Share with friends for beta testing
