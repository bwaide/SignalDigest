-- Create sources table for managing content sources (newsletters, RSS, etc.)
CREATE TABLE sources (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source identification
  source_type TEXT NOT NULL DEFAULT 'email',
  identifier TEXT NOT NULL,  -- Format: "email@domain.com|Sender Name" for emails
  display_name TEXT NOT NULL,

  -- Extraction configuration (Phase 2 - stored but not used yet)
  extraction_strategy_id TEXT NOT NULL DEFAULT 'generic',

  -- Status and lifecycle
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signal_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,

  -- Metadata for future extensibility
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  UNIQUE(user_id, source_type, identifier),
  CHECK (status IN ('pending', 'active', 'rejected', 'paused')),
  CHECK (source_type IN ('email', 'rss', 'youtube', 'podcast', 'twitter'))
);

-- Indexes for performance
CREATE INDEX idx_sources_user_status ON sources(user_id, status);
CREATE INDEX idx_sources_type_status ON sources(source_type, status);

-- Enable Row Level Security
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sources"
  ON sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sources"
  ON sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources"
  ON sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources"
  ON sources FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing signals to sources (all marked as 'active')
INSERT INTO sources (
  user_id,
  source_type,
  identifier,
  display_name,
  extraction_strategy_id,
  status,
  last_signal_at,
  activated_at,
  created_at
)
SELECT DISTINCT
  user_id,
  'email' as source_type,
  source_identifier as identifier,
  -- Extract display name from identifier (format: "email|name")
  COALESCE(
    NULLIF(SPLIT_PART(source_identifier, '|', 2), ''),  -- Use sender name if available
    SPLIT_PART(SPLIT_PART(source_identifier, '|', 1), '@', 1)  -- Fallback to email username
  ) as display_name,
  'generic' as extraction_strategy_id,
  'active' as status,  -- All existing sources are active
  MAX(received_date) as last_signal_at,
  MIN(created_at) as activated_at,  -- First signal = activation time
  MIN(created_at) as created_at
FROM signals
WHERE source_identifier IS NOT NULL
  AND source_identifier != ''
GROUP BY user_id, source_identifier
ON CONFLICT (user_id, source_type, identifier) DO NOTHING;
