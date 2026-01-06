-- Enable pg_cron extension for server-side auto-sync
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant necessary permissions to use pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Enable http extension for making HTTP requests from postgres
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create a function to trigger email import for a specific user via webhook
-- This calls the Next.js API endpoint instead of Edge Function directly
-- No credentials stored in database - API key is stored in auto_sync_jobs table
CREATE OR REPLACE FUNCTION public.trigger_auto_sync(p_user_id uuid, p_webhook_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response extensions.http_response;
BEGIN
  -- Call the Next.js cron webhook endpoint
  -- The endpoint will check if auto-sync is enabled and call the Edge Function
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

-- Create a table to track auto-sync jobs
-- Stores webhook URL and API key for each user's cron job
CREATE TABLE IF NOT EXISTS public.auto_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cron_job_id bigint NOT NULL,
  interval_minutes integer NOT NULL,
  webhook_url text NOT NULL, -- Next.js API endpoint URL
  api_key text NOT NULL, -- Simple API key for webhook authentication
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on auto_sync_jobs table
ALTER TABLE public.auto_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for auto_sync_jobs
CREATE POLICY "Users can view their own auto-sync jobs"
  ON public.auto_sync_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto-sync jobs"
  ON public.auto_sync_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-sync jobs"
  ON public.auto_sync_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto-sync jobs"
  ON public.auto_sync_jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to schedule auto-sync for a user
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
  -- Convert interval to cron schedule
  -- For simplicity, we'll use minute-based schedules
  -- e.g., */30 * * * * for every 30 minutes
  v_cron_schedule := format('*/%s * * * *', p_interval_minutes);

  -- Schedule the cron job with webhook URL and API key
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

-- Create function to unschedule auto-sync for a user
CREATE OR REPLACE FUNCTION public.unschedule_auto_sync(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_name text;
BEGIN
  v_job_name := format('auto-sync-%s', p_user_id);

  -- Unschedule the cron job
  PERFORM cron.unschedule(v_job_name);
END;
$$;

-- Create function to update auto-sync schedule for a user
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
  -- Unschedule existing job
  PERFORM public.unschedule_auto_sync(p_user_id);

  -- Schedule new job with updated interval
  v_job_id := public.schedule_auto_sync(
    p_user_id,
    p_interval_minutes,
    p_webhook_url,
    p_api_key
  );

  RETURN v_job_id;
END;
$$;
