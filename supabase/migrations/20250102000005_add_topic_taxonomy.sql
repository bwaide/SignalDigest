-- Add topic field to nuggets table (single taxonomy topic, required)
ALTER TABLE nuggets
ADD COLUMN topic TEXT;

-- Add taxonomy topics to user_settings (user-defined topic categories)
ALTER TABLE user_settings
ADD COLUMN taxonomy_topics TEXT[] DEFAULT ARRAY[
  'AI & Machine Learning',
  'Social Media & Culture',
  'Business & Finance',
  'Tech Products & Innovation',
  'Climate & Energy',
  'Health & Science',
  'Policy & Regulation',
  'Startups & Funding'
]::TEXT[];

-- Update existing nuggets to have a topic based on their tags
-- This is a one-time migration to populate the new field
UPDATE nuggets
SET topic = CASE
  WHEN 'AI' = ANY(tags) OR 'Machine Learning' = ANY(tags) THEN 'AI & Machine Learning'
  WHEN 'Social Media' = ANY(tags) OR 'Instagram' = ANY(tags) THEN 'Social Media & Culture'
  WHEN 'Meta' = ANY(tags) OR 'Manus' = ANY(tags) THEN 'Business & Finance'
  WHEN 'Tech Innovation' = ANY(tags) OR 'Technology' = ANY(tags) THEN 'Tech Products & Innovation'
  WHEN 'OpenAI' = ANY(tags) OR 'SoftBank' = ANY(tags) THEN 'Startups & Funding'
  ELSE 'AI & Machine Learning' -- Default fallback
END
WHERE topic IS NULL;

-- Make topic required going forward (after backfilling existing data)
ALTER TABLE nuggets
ALTER COLUMN topic SET NOT NULL;

-- Add index for topic filtering (performance optimization)
CREATE INDEX idx_nuggets_topic ON nuggets(topic);

-- Add comment explaining the difference between topic and tags
COMMENT ON COLUMN nuggets.topic IS 'Single taxonomy topic from user-defined taxonomy (structured, for filtering/navigation)';
COMMENT ON COLUMN nuggets.tags IS 'AI-generated flexible tags (unstructured, for search/metadata)';
COMMENT ON COLUMN user_settings.taxonomy_topics IS 'User-defined topic taxonomy for categorizing nuggets (shown in FilterRail)';
