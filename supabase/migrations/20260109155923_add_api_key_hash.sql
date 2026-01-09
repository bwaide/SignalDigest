-- Add api_key_hash column to user_settings for external API authentication
-- The API key itself is never stored; only a bcrypt hash is kept

ALTER TABLE user_settings
ADD COLUMN api_key_hash TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN user_settings.api_key_hash IS 'Bcrypt hash of the user API key for external API authentication. The plaintext key is shown only once at generation time.';
