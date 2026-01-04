-- Create public wrapper functions for Supabase Vault operations
-- This exposes vault functionality through the PostgREST API

-- Wrapper for vault.create_secret
CREATE OR REPLACE FUNCTION public.create_secret(
  new_secret text,
  new_name text DEFAULT NULL,
  new_description text DEFAULT '',
  new_key_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
BEGIN
  -- Only allow service_role to create secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service_role can create secrets';
  END IF;

  RETURN vault.create_secret(new_secret, new_name, new_description, new_key_id);
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION public.create_secret TO service_role;

-- Create a view in public schema for decrypted_secrets
CREATE OR REPLACE VIEW public.decrypted_secrets
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  description,
  decrypted_secret,
  key_id,
  created_at,
  updated_at
FROM vault.decrypted_secrets;

-- Grant select permission to service_role
GRANT SELECT ON public.decrypted_secrets TO service_role;
