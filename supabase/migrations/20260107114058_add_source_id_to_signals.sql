-- Add source_id foreign key to signals table
ALTER TABLE signals
  ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

-- Link existing signals to sources
UPDATE signals s
SET source_id = src.id
FROM sources src
WHERE s.source_identifier = src.identifier
  AND s.user_id = src.user_id
  AND s.source_id IS NULL;  -- Only update unlinked signals

-- Create index for performance
CREATE INDEX idx_signals_source ON signals(source_id);
