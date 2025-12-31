-- Add dev user for local testing (only runs in development)
-- TODO: Remove this migration before production deployment

-- Insert dev user into auth.users if not exists
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@example.com',
  '$2a$10$AAAAAAAAAAAAAAAAAAAAAO', -- Invalid bcrypt hash (can't be used to login)
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;
