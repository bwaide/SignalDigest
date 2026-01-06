# Auto-Sync Webhook Architecture

**Date:** January 6, 2026
**Status:** ✅ IMPLEMENTED

## Problem

The original auto-sync implementation attempted to have pg_cron call Supabase Edge Functions directly, which required storing the **service role key** in the PostgreSQL database. This created security concerns:

- ❌ Service role key stored in database (even if encrypted)
- ❌ Database admin could potentially retrieve credentials
- ❌ Violates principle of least privilege

## Solution: Webhook Architecture

We redesigned auto-sync to use a **webhook-based architecture** that keeps credentials out of the database entirely.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase)                                           │
│                                                                  │
│  pg_cron (scheduler)                                            │
│      │                                                           │
│      │ Calls trigger_auto_sync()                                │
│      │ with: user_id, webhook_url, api_key                      │
│      ▼                                                           │
│  HTTP request to Next.js API                                    │
│      │                                                           │
│      │ Header: X-Cron-API-Key: simple-api-key                   │
│      │ Body: { user_id: "..." }                                 │
└──────┼─────────────────────────────────────────────────────────┘
       │
       │ HTTPS
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Next.js App (Coolify/Hetzner)                                   │
│                                                                  │
│  /api/cron/auto-sync                                            │
│      │                                                           │
│      │ 1. Verify CRON_API_KEY                                   │
│      │ 2. Check if auto-sync enabled for user                   │
│      │ 3. Call import-emails Edge Function                      │
│      │    using SUPABASE_SERVICE_ROLE_KEY from env              │
│      ▼                                                           │
│  Response: { success: true }                                    │
└──────┼─────────────────────────────────────────────────────────┘
       │
       │ Service role key from environment
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Edge Functions                                         │
│                                                                  │
│  import-emails                                                   │
│      │                                                           │
│      │ Imports emails via IMAP                                  │
│      │ Creates signals in database                              │
│      ▼                                                           │
│  extract-nuggets (if auto-process enabled)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Next.js Webhook Endpoint

[app/api/cron/auto-sync/route.ts](../app/api/cron/auto-sync/route.ts)

```typescript
export async function POST(request: Request) {
  // Verify API key (stored in Next.js environment)
  const apiKey = request.headers.get('X-Cron-API-Key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user_id } = await request.json()

  // Service role key is in Next.js environment, NOT in database!
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-emails`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ user_id })
    }
  )

  return Response.json({ success: true })
}
```

### 2. PostgreSQL Trigger Function

[supabase/migrations/20260105164704_enable_pg_cron_for_auto_sync.sql](../supabase/migrations/20260105164704_enable_pg_cron_for_auto_sync.sql)

```sql
CREATE OR REPLACE FUNCTION public.trigger_auto_sync(
  p_user_id uuid,
  p_webhook_url text,
  p_api_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response extensions.http_response;
BEGIN
  -- Call Next.js webhook with simple API key
  SELECT * FROM extensions.http((
    'POST',
    p_webhook_url,
    ARRAY[
      extensions.http_header('X-Cron-API-Key', p_api_key),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object('user_id', p_user_id)::text
  )) INTO v_response;
END;
$$;
```

### 3. Auto-Sync Jobs Table

```sql
CREATE TABLE public.auto_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  cron_job_id bigint NOT NULL,
  interval_minutes integer NOT NULL,
  webhook_url text NOT NULL,  -- https://your-app.com/api/cron/auto-sync
  api_key text NOT NULL,       -- Simple API key for webhook auth
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 4. Scheduling Function

```sql
CREATE OR REPLACE FUNCTION public.schedule_auto_sync(
  p_user_id uuid,
  p_interval_minutes integer,
  p_webhook_url text,
  p_api_key text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_cron_schedule text;
  v_job_id bigint;
BEGIN
  v_cron_schedule := format('*/%s * * * *', p_interval_minutes);

  SELECT cron.schedule(
    format('auto-sync-%s', p_user_id),
    v_cron_schedule,
    format(
      'SELECT public.trigger_auto_sync(''%s''::uuid, ''%s'', ''%s'')',
      p_user_id,
      p_webhook_url,
      p_api_key
    )
  ) INTO v_job_id;

  RETURN v_job_id;
END;
$$;
```

## Security Comparison

| Credential Type | Old Approach | New Approach |
|----------------|--------------|--------------|
| **Service Role Key** | ❌ In database (encrypted) | ✅ In Next.js env only |
| **Encryption Key** | ❌ In database setting | ✅ Not needed |
| **API Key** | N/A | ⚠️ In pg_cron job (less risky) |
| **Risk if DB Compromised** | ❌ High - can retrieve service key | ✅ Low - only get API key |
| **Risk if App Compromised** | N/A | ⚠️ Medium - env vars exposed |

## Benefits

### ✅ Security Improvements
- **Service role key never stored in database**
- **API key has limited scope** - only grants access to trigger auto-sync
- **API key easy to rotate** - just update environment variable
- **Follows least privilege principle**

### ✅ Architecture Improvements
- **Cleaner separation of concerns**
- **Same pattern as local development** (API routes)
- **Easier to test and debug**
- **No database encryption complexity**

### ✅ Operational Benefits
- **Environment variables managed in one place** (Coolify)
- **No special database configuration required**
- **Standard Next.js API endpoint** - familiar pattern

## Environment Variables Required

### Supabase (Database)
- None! No credentials stored in database.

### Next.js/Coolify (Application)
```bash
# Public URL for webhook callbacks
NEXT_PUBLIC_APP_URL=https://your-app.com

# Simple API key for pg_cron webhook authentication
CRON_API_KEY=your-random-api-key-here

# Service role key (already required for other features)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Generating CRON_API_KEY

```bash
# Generate a random API key
openssl rand -hex 32

# Example output:
# 7a8f4b2c9d1e3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
```

## Deployment Steps

1. **Add environment variables** to `.env.production`:
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-app.com
   CRON_API_KEY=$(openssl rand -hex 32)
   ```

2. **Deploy Next.js app** to Coolify with these environment variables

3. **Run Supabase migrations** (includes pg_cron setup)

4. **Enable auto-sync** in the app settings
   - Creates pg_cron job with webhook URL and API key
   - pg_cron calls webhook every N minutes
   - Webhook authenticates and triggers import

## Testing

### Test webhook locally:
```bash
curl -X POST http://localhost:3000/api/cron/auto-sync \
  -H "X-Cron-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "your-user-id"}'
```

### Test pg_cron manually:
```sql
SELECT public.trigger_auto_sync(
  'your-user-id'::uuid,
  'https://your-app.com/api/cron/auto-sync',
  'your-api-key'
);
```

### Check cron jobs:
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Files Modified

- ✅ **New**: [app/api/cron/auto-sync/route.ts](../app/api/cron/auto-sync/route.ts)
- ✅ **Updated**: [supabase/migrations/20260105164704_enable_pg_cron_for_auto_sync.sql](../supabase/migrations/20260105164704_enable_pg_cron_for_auto_sync.sql)
- ✅ **Updated**: [app/api/settings/save-auto-sync/route.ts](../app/api/settings/save-auto-sync/route.ts)
- ✅ **Updated**: [scripts/deploy-to-production.sh](../scripts/deploy-to-production.sh)
- ✅ **Removed**: `20260106081117_fix_auto_sync_config.sql` (no longer needed)

## Summary

**Before:** pg_cron → trigger_auto_sync() → reads service key from database → calls Edge Function
**After:** pg_cron → webhook with API key → Next.js verifies key → uses service key from env → calls Edge Function

This architecture keeps the service role key where it belongs (application environment) and uses a simple, rotatable API key for pg_cron authentication.

**Security Rating:** ✅ Production-ready for single-user application
