# Data Migration from Dev to Production

## Issue Fixed

The export script had a bug where `approved_topics` (a `TEXT[]` column) was being cast as `::jsonb`. This has been fixed in [scripts/export-dev-data.js](export-dev-data.js:21-35).

## Current Situation

Your local Supabase database appears to be unavailable or reset. You have two options:

### Option 1: Restore Local Data First (Recommended if you have a backup)

1. If you have a database backup, restore it first:
   ```bash
   # Check for docker volumes
   docker volume ls --filter label=com.supabase.cli.project=signal-digest

   # If you have a backup, you can restore from it
   ```

2. Once restored, run the fixed export script:
   ```bash
   node scripts/export-dev-data.js
   ```

3. This will generate `scripts/migrate-dev-to-prod.sql` with correct types

### Option 2: Manual SQL Creation

If you don't have a backup but remember your settings, you can manually create the SQL file for `user_settings`:

```sql
-- Migration script to copy development data to production
BEGIN;

INSERT INTO user_settings (
  user_id,
  interests_description,
  relevancy_threshold,
  approved_topics,
  signal_sources,
  auto_sync_enabled,
  auto_sync_interval_minutes,
  created_at,
  updated_at
) VALUES (
  'f122b84f-8ee1-436d-a0df-0285d93caaaf',
  'Your interests description here',
  70,
  ARRAY['AI Development','AI Tools & Applications','Business Strategy'],  -- TEXT[] format
  '[{"type":"email","status":"connected","config":{...}}]'::jsonb,  -- JSONB format
  true,
  60,
  NOW(),
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  interests_description = EXCLUDED.interests_description,
  relevancy_threshold = EXCLUDED.relevancy_threshold,
  approved_topics = EXCLUDED.approved_topics,
  signal_sources = EXCLUDED.signal_sources,
  auto_sync_enabled = EXCLUDED.auto_sync_enabled,
  auto_sync_interval_minutes = EXCLUDED.auto_sync_interval_minutes,
  updated_at = EXCLUDED.updated_at;

COMMIT;
```

### Option 3: Start Fresh on Production

Just configure your settings directly in production through the UI, then use the auto-sync feature.

## Type Reference

For reference, here are the correct PostgreSQL types for each column:

- `approved_topics`: `TEXT[]` - Use `ARRAY['item1','item2']` syntax
- `signal_sources`: `JSONB` - Use `'[...]'::jsonb` syntax
- `metadata`: `JSONB` - Use `'{...}'::jsonb` syntax

## Applying to Production

Once you have a valid SQL file:

1. Review it:
   ```bash
   cat scripts/migrate-dev-to-prod.sql
   ```

2. Apply to production using the deployment script:
   ```bash
   ./scripts/apply-dev-data-to-prod.sh
   ```

   This script will:
   - Load `.env.production` for credentials
   - Link to production
   - Execute the SQL file using `psql`
   - Or provide instructions for Supabase Studio SQL editor if `psql` is not available
