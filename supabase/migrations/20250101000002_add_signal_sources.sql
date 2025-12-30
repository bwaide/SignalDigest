-- Add signal_sources JSONB column for extensible signal configuration
-- This supports email, YouTube, RSS, podcast, and other future signal types
ALTER TABLE user_settings ADD COLUMN signal_sources JSONB DEFAULT '[]'::jsonb;

-- Add GIN index for efficient JSONB queries
CREATE INDEX idx_user_settings_signal_sources ON user_settings USING GIN (signal_sources);
