-- Add webhook columns to existing auto_sync_jobs table
-- This migration allows local testing without resetting the database

-- Add webhook_url and api_key columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'auto_sync_jobs'
    AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE public.auto_sync_jobs
    ADD COLUMN webhook_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'auto_sync_jobs'
    AND column_name = 'api_key'
  ) THEN
    ALTER TABLE public.auto_sync_jobs
    ADD COLUMN api_key text;
  END IF;
END $$;

-- Set default values for existing rows (for local testing)
-- In production, these will be set when users enable auto-sync
UPDATE public.auto_sync_jobs
SET
  webhook_url = COALESCE(webhook_url, 'http://localhost:3000/api/cron/auto-sync'),
  api_key = COALESCE(api_key, 'local-dev-key')
WHERE webhook_url IS NULL OR api_key IS NULL;

-- Now make them NOT NULL
ALTER TABLE public.auto_sync_jobs
ALTER COLUMN webhook_url SET NOT NULL;

ALTER TABLE public.auto_sync_jobs
ALTER COLUMN api_key SET NOT NULL;

-- Update the trigger_auto_sync function to accept webhook parameters
-- This replaces the old version that tried to read from database settings
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
  -- Call the Next.js cron webhook endpoint
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

  -- Log the response
  IF v_response.status >= 200 AND v_response.status < 300 THEN
    RAISE NOTICE 'Auto-sync triggered for user %, status: %', p_user_id, v_response.status;
  ELSE
    RAISE WARNING 'Auto-sync failed for user %, status: %, response: %',
      p_user_id, v_response.status, v_response.content;
  END IF;
END;
$$;

-- Update schedule_auto_sync function to accept webhook parameters
CREATE OR REPLACE FUNCTION public.schedule_auto_sync(
  p_user_id uuid,
  p_interval_minutes integer,
  p_webhook_url text,
  p_api_key text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Update update_auto_sync_schedule function
CREATE OR REPLACE FUNCTION public.update_auto_sync_schedule(
  p_user_id uuid,
  p_interval_minutes integer,
  p_webhook_url text,
  p_api_key text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  PERFORM public.unschedule_auto_sync(p_user_id);

  v_job_id := public.schedule_auto_sync(
    p_user_id,
    p_interval_minutes,
    p_webhook_url,
    p_api_key
  );

  RETURN v_job_id;
END;
$$;
