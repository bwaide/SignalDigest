-- Add auto-sync settings to user_settings table
ALTER TABLE user_settings
ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN auto_sync_interval_minutes INTEGER DEFAULT 30;

-- Add comment explaining the columns
COMMENT ON COLUMN user_settings.auto_sync_enabled IS 'Enable automatic email checking at regular intervals';
COMMENT ON COLUMN user_settings.auto_sync_interval_minutes IS 'Interval in minutes between automatic email checks';
