-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('email', 'youtube', 'social_media', 'rss', 'podcast')),
  raw_content TEXT,
  title TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  source_url TEXT,
  received_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nuggets table
CREATE TABLE nuggets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_id UUID REFERENCES signals NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  link TEXT,
  source TEXT NOT NULL,
  published_date TIMESTAMPTZ NOT NULL,
  relevancy_score INTEGER NOT NULL CHECK (relevancy_score >= 0 AND relevancy_score <= 100),
  tags TEXT[] NOT NULL DEFAULT '{}',
  duplicate_group_id UUID,
  is_primary BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  interests_description TEXT,
  relevancy_threshold INTEGER DEFAULT 60 CHECK (relevancy_threshold >= 0 AND relevancy_threshold <= 100),
  approved_topics TEXT[] DEFAULT ARRAY[
    'AI Development',
    'AI Tools & Applications',
    'Business Strategy',
    'Consulting & Services',
    'Productivity & Automation',
    'Marketing & Sales',
    'Operations & Finance',
    'Tech Industry',
    'Self-Development'
  ],
  email_check_frequency INTERVAL DEFAULT '6 hours',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create processing_errors table
CREATE TABLE processing_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id UUID REFERENCES signals,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX idx_signals_user_status ON signals(user_id, status, received_date);
CREATE INDEX idx_nuggets_user_created ON nuggets(user_id, created_at DESC);
CREATE INDEX idx_nuggets_duplicate_group ON nuggets(duplicate_group_id);
CREATE INDEX idx_nuggets_tags ON nuggets USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuggets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signals
CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
  ON signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
  ON signals FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for nuggets
CREATE POLICY "Users can view own nuggets"
  ON nuggets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nuggets"
  ON nuggets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nuggets"
  ON nuggets FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for processing_errors
CREATE POLICY "Users can view errors for own signals"
  ON processing_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM signals
      WHERE signals.id = processing_errors.signal_id
      AND signals.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
