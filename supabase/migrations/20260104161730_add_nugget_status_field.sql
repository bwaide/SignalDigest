-- Add status field to nuggets table
-- Status can be: 'unread', 'archived', 'saved'
-- Default is 'unread'

-- Add status column
ALTER TABLE nuggets
ADD COLUMN status TEXT NOT NULL DEFAULT 'unread';

-- Add check constraint to ensure valid status values
ALTER TABLE nuggets
ADD CONSTRAINT nugget_status_check CHECK (status IN ('unread', 'archived', 'saved'));

-- Migrate existing data based on is_read and is_archived flags
-- is_read=true AND is_archived=true -> 'archived'
-- is_read=true AND is_archived=false -> 'archived' (read but not explicitly saved)
-- is_read=false -> 'unread'
UPDATE nuggets
SET status = CASE
  WHEN is_archived = true THEN 'archived'
  WHEN is_read = true THEN 'archived'
  ELSE 'unread'
END;

-- Keep is_read and is_archived for backward compatibility during transition
-- We'll remove them in a future migration after confirming everything works

-- Add index on status for faster filtering
CREATE INDEX idx_nuggets_status ON nuggets(status);

-- Add index on user_id + status for common query pattern
CREATE INDEX idx_nuggets_user_status ON nuggets(user_id, status);
