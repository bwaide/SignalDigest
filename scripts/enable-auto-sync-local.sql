-- Enable auto-sync for local testing
-- Replace USER_ID with your actual user ID

-- Update user settings to enable auto-sync
UPDATE user_settings
SET
  auto_sync_enabled = true,
  auto_sync_interval_minutes = 30
WHERE user_id = 'd87dcb3e-78b2-4e84-b7c2-51ba5368600d';

-- Create pg_cron job
SELECT public.schedule_auto_sync(
  'd87dcb3e-78b2-4e84-b7c2-51ba5368600d'::uuid,
  30,
  'http://localhost:3000/api/cron/auto-sync',
  'f946da2a380013c19226902987fb42e032c2886353fe36b784bed4834af12268'
);

-- Verify settings
SELECT user_id, auto_sync_enabled, auto_sync_interval_minutes
FROM user_settings
WHERE user_id = 'd87dcb3e-78b2-4e84-b7c2-51ba5368600d';

-- Verify cron job
SELECT * FROM cron.job WHERE jobname LIKE 'auto-sync-%';

-- Verify auto_sync_jobs record
SELECT * FROM auto_sync_jobs WHERE user_id = 'd87dcb3e-78b2-4e84-b7c2-51ba5368600d';
