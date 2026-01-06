# Auto-Sync Architecture: Security Comparison

**Date:** January 6, 2026

## The Security Problem

The current approach stores the Supabase service role key in PostgreSQL so that pg_cron can call Edge Functions. This raises security concerns:

- **Issue**: Service role key stored in database (even if encrypted)
- **Risk**: Database admin or anyone with direct database access can retrieve it
- **Concern**: Encryption key must also be stored somewhere accessible to decrypt

## Architecture Options

### Option 1: Current Approach (Encrypted Table) ❌

**How it works:**
```
pg_cron → trigger_auto_sync() → reads encrypted key from table → calls Edge Function
```

**Pros:**
- All scheduling logic in one place (PostgreSQL)
- Works with existing Supabase infrastructure

**Cons:**
- ❌ Service role key stored in database (encrypted)
- ❌ Encryption key must be accessible to decrypt
- ❌ Anyone with database access can potentially retrieve credentials
- ❌ Uses ALTER DATABASE SET (which caused the original error)

**Security Rating:** ⚠️ Medium Risk

---

### Option 2: Public Webhook with API Key ✅ RECOMMENDED

**How it works:**
```
pg_cron → calls public Next.js API endpoint → authenticates with custom API key → triggers import
```

**Architecture:**
```typescript
// app/api/cron/auto-sync/route.ts
export async function POST(request: Request) {
  // Verify cron API key (stored in environment variable)
  const apiKey = request.headers.get('X-Cron-API-Key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user_id } = await request.json()

  // Call import-emails Edge Function
  // Service role key is in Next.js environment (not in database!)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-emails`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id })
    }
  )

  return Response.json({ success: true })
}
```

**pg_cron job:**
```sql
SELECT cron.schedule(
  'auto-sync-user-123',
  '*/30 * * * *',
  $$
  SELECT extensions.http((
    'POST',
    'https://your-app.com/api/cron/auto-sync',
    ARRAY[extensions.http_header('X-Cron-API-Key', 'your-random-api-key')],
    'application/json',
    '{"user_id": "123"}'
  ))
  $$
);
```

**Pros:**
- ✅ No service role key in database
- ✅ Custom API key (easy to rotate)
- ✅ API key only grants access to cron endpoint (not full database)
- ✅ Service role key stays in Next.js environment variables
- ✅ Simple to implement and understand

**Cons:**
- ⚠️ Requires Next.js app to be publicly accessible
- ⚠️ API key still stored in pg_cron job definition (but less risky than service role key)

**Security Rating:** ✅ Low Risk (RECOMMENDED)

---

### Option 3: External Cron Service (GitHub Actions) ✅ ALTERNATIVE

**How it works:**
```
GitHub Actions (scheduled) → calls Next.js API → triggers import
```

**.github/workflows/auto-sync.yml:**
```yaml
name: Auto-Sync

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  auto-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto-Sync
        run: |
          curl -X POST https://your-app.com/api/cron/auto-sync \
            -H "X-Cron-API-Key: ${{ secrets.CRON_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"user_id": "${{ secrets.USER_ID }}"}'
```

**Pros:**
- ✅ No credentials in database at all
- ✅ GitHub Secrets are properly encrypted
- ✅ Free (GitHub Actions has generous free tier)
- ✅ Easy to monitor (GitHub Actions UI)
- ✅ Can run per-user schedules with different secrets

**Cons:**
- ⚠️ Requires GitHub repository
- ⚠️ Scheduling logic outside of main infrastructure
- ⚠️ Less flexible than database-based scheduling

**Security Rating:** ✅ Lowest Risk (BEST SECURITY)

---

## Recommendation

For your **single-user MVP**, I recommend **Option 2** (Public Webhook with API Key):

### Why Option 2 is Best for Your Use Case

1. **Simple**: One API endpoint, one API key
2. **Secure Enough**: API key only grants access to trigger auto-sync, not full database
3. **Easy to Rotate**: Just change the API key and update pg_cron job
4. **Keeps Logic Centralized**: All scheduling in PostgreSQL pg_cron
5. **No External Dependencies**: Unlike GitHub Actions

### Implementation Plan

1. Create `/api/cron/auto-sync/route.ts` with API key authentication
2. Store `CRON_API_KEY` in Next.js environment (Coolify)
3. Update pg_cron jobs to call this endpoint instead of Edge Function directly
4. Remove `auto_sync_config` table entirely
5. No service role key in database!

### Security Comparison

| Credential | Option 1 (Current) | Option 2 (Recommended) | Option 3 (GitHub) |
|------------|-------------------|----------------------|-------------------|
| Service Role Key | In database (encrypted) | In Next.js env | In Next.js env |
| Encryption Key | In database setting | N/A | N/A |
| API Key | N/A | In pg_cron job | In GitHub Secrets |
| Risk if Database Compromised | High (can retrieve service key) | Low (only get API key) | None |
| Risk if App Compromised | Medium | High (env vars exposed) | Medium |

## Next Steps

Would you like me to implement **Option 2** (Public Webhook with API Key)? This would:
1. Remove credentials from database entirely
2. Create a simple API endpoint for pg_cron to call
3. Keep all the benefits of server-side auto-sync
4. Significantly improve security

The implementation would take about 30 minutes and is much cleaner than storing credentials in PostgreSQL.
