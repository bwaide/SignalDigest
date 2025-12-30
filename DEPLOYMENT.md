# Deployment Guide

## Prerequisites

- Hetzner VPS with Coolify installed
- Supabase project (production)
- GitHub repository

## Steps

### 1. Create Production Supabase Project

Via Supabase Dashboard:
1. Create new project: "signal-digest-prod"
2. Wait for provisioning (2-3 minutes)
3. Save credentials:
   - Project URL
   - Anon key
   - Service role key

### 2. Apply Database Migrations

```bash
# Link to production project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### 3. Configure Coolify

1. Create new project in Coolify
2. Source: GitHub repository
3. Build Pack: Nixpacks (auto-detected)
4. Branch: `main`
5. Auto-deploy: ✅ Enabled

Environment Variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[production-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[production-service-role-key]
AI_GATEWAY_URL=[your-gateway-url]
AI_GATEWAY_API_KEY=[your-gateway-key]
```

### 4. Deploy

```bash
git push origin main
```

Coolify will:
- Detect Next.js project
- Install dependencies
- Build production bundle
- Deploy with zero downtime
- Configure SSL via Let's Encrypt

### 5. Verify Deployment

1. Visit deployed URL
2. Check dashboard loads
3. Verify Supabase connection
4. Test authentication flow (coming in Phase 2)

## Troubleshooting

### Build fails
- Check Coolify logs
- Verify environment variables
- Ensure Node.js version compatibility

### Database connection errors
- Verify SUPABASE_URL is correct
- Check RLS policies are enabled
- Confirm migrations applied

### SSL issues
- Wait 2-3 minutes for Let's Encrypt
- Check domain DNS configuration
- Review Coolify SSL logs
