# Server-Side Auto-Sync Implementation

**Date:** January 5, 2026
**Status:** ✅ IMPLEMENTED

## Overview

Auto-sync has been migrated from a browser-based implementation to a reliable server-side system using PostgreSQL's `pg_cron` extension. This addresses a critical production readiness blocker.

## Problem with Browser-Based Auto-Sync

The previous implementation had several issues:
- Only worked when browser tab was open
- Stopped when user closed tab or computer went to sleep
- Multiple tabs caused duplicate sync operations
- High battery drain on mobile/laptop
- Unreliable for production use

## Server-Side Solution

### Architecture

1. **pg_cron Extension**: PostgreSQL's built-in cron scheduler
2. **Auto-Sync Edge Function**: Supabase Edge Function that handles email import
3. **Database Trigger Function**: PostgreSQL function that calls the Edge Function via HTTP
4. **Job Management**: API endpoints to create/update/delete cron jobs

### Components

#### 1. Database Migration: `20260105164704_enable_pg_cron_for_auto_sync.sql`

Creates:
- `pg_cron` and `http` extensions
- `auto_sync_jobs` table to track user schedules
- `trigger_auto_sync(user_id)` function to call Edge Function
- `schedule_auto_sync(user_id, interval_minutes)` function
- `unschedule_auto_sync(user_id)` function
- `update_auto_sync_schedule(user_id, interval_minutes)` function
- RLS policies for the `auto_sync_jobs` table

#### 2. Edge Function: `supabase/functions/auto-sync/index.ts`

- Receives user_id from pg_cron trigger
- Checks if auto-sync is enabled for the user
- Calls the `import-emails` Edge Function
- Returns success/failure status

#### 3. API Endpoint: `app/api/settings/save-auto-sync/route.ts`

Enhanced to:
- Save user_settings (enabled, interval_minutes) as before
- Create/update/delete pg_cron jobs based on settings
- Track jobs in the `auto_sync_jobs` table

### How It Works

1. **User Enables Auto-Sync**:
   - User sets interval (e.g., 30 minutes) in Settings UI
   - Frontend calls `/api/settings/save-auto-sync`
   - API saves settings to `user_settings` table
   - API calls `schedule_auto_sync()` to create pg_cron job
   - Job is stored in `auto_sync_jobs` table

2. **Cron Job Execution**:
   - pg_cron runs every N minutes based on user's interval
   - Executes `trigger_auto_sync(user_id)` function
   - Function makes HTTP request to `/functions/v1/auto-sync` Edge Function
   - Edge Function imports emails and processes them

3. **User Updates Interval**:
   - API calls `update_auto_sync_schedule()`
   - Old cron job is unscheduled
   - New cron job is created with updated interval

4. **User Disables Auto-Sync**:
   - API calls `unschedule_auto_sync()`
   - Cron job is removed
   - Record is deleted from `auto_sync_jobs` table

### Database Schema

```sql
CREATE TABLE auto_sync_jobs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  cron_job_id bigint NOT NULL,
  interval_minutes integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
```

### API Endpoints

#### POST `/api/settings/save-auto-sync`
Saves auto-sync settings and manages pg_cron schedule.

**Request Body:**
```json
{
  "enabled": true,
  "interval_minutes": 30
}
```

**Response:**
```json
{
  "success": true
}
```

#### GET `/api/settings/load-auto-sync`
Loads current auto-sync settings.

**Response:**
```json
{
  "success": true,
  "settings": {
    "enabled": true,
    "interval_minutes": 30
  }
}
```

### Cron Schedule Format

The system converts interval minutes to cron format:
- `*/30 * * * *` = Every 30 minutes
- `*/60 * * * *` = Every 60 minutes (1 hour)

### Environment Variables Required

For the Edge Function to call the import-emails function:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for bypassing RLS

These are set in the database via:
```sql
SELECT set_config('app.settings.supabase_url', 'https://your-project.supabase.co', false);
SELECT set_config('app.settings.service_role_key', 'your-service-role-key', false);
```

## Benefits

✅ **Reliability**: Runs even when user is offline
✅ **Consistency**: Single execution per interval (no duplicates)
✅ **Battery Efficient**: No client-side timers
✅ **Scalability**: Handles multiple users independently
✅ **Production Ready**: Uses battle-tested pg_cron

## Migration from Browser-Based

1. **Removed Components**:
   - `lib/auto-sync.ts` - AutoSyncManager class (kept for reference)
   - `lib/hooks/use-auto-sync.ts` - useAutoSync React hook (kept for reference)
   - Auto-sync logic in `DashboardV2.tsx`

2. **Preserved**:
   - Settings UI in `components/settings/AutoSyncSettings.tsx`
   - User preferences in `user_settings` table

3. **Added**:
   - pg_cron extension and functions
   - `auto_sync_jobs` table
   - `auto-sync` Edge Function
   - Job management in save-auto-sync endpoint

## Testing

### Local Development

1. **Enable pg_cron**:
   ```bash
   supabase db reset
   ```

2. **Set Environment Variables**:
   ```sql
   SELECT set_config('app.settings.supabase_url', 'http://127.0.0.1:54331', false);
   SELECT set_config('app.settings.service_role_key', '<your-local-service-key>', false);
   ```

3. **Test Auto-Sync**:
   - Enable auto-sync in Settings UI
   - Check `cron.job` table for scheduled jobs:
     ```sql
     SELECT * FROM cron.job;
     ```
   - Wait for interval or manually trigger:
     ```sql
     SELECT trigger_auto_sync('<your-user-id>');
     ```

### Production

1. Deploy Edge Function:
   ```bash
   supabase functions deploy auto-sync
   ```

2. Apply migration:
   ```bash
   supabase db push
   ```

3. Set production environment variables in Supabase Dashboard

## Troubleshooting

### Check Cron Jobs
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'auto-sync-%';
```

### Check Auto-Sync Jobs Table
```sql
SELECT * FROM auto_sync_jobs;
```

### View Cron Job Run History
```sql
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'auto-sync-%')
ORDER BY start_time DESC
LIMIT 10;
```

### Manually Trigger Auto-Sync
```sql
SELECT trigger_auto_sync('<user-id>');
```

## Future Enhancements

- [ ] Add retry logic for failed syncs
- [ ] Implement max retries per interval
- [ ] Add sync status/history to UI
- [ ] Send notifications on sync errors
- [ ] Add metrics/monitoring for sync operations
- [ ] Support different schedules per user (hourly, daily, etc.)

## Production Readiness

This implementation addresses the critical blocker:
- 🔴 **Browser-based Auto-Sync** → ✅ **Server-side with pg_cron**

Related production readiness items still pending:
- 🔴 No error monitoring
- 🔴 No rate limiting
- 🟡 No job queue for email processing

See `docs/production-readiness-report.md` for full checklist.
