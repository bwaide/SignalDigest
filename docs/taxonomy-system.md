# Taxonomy System Architecture

## Overview

Signal Digest now uses a **dual-layer categorization system** that separates structured topic taxonomy (for navigation/filtering) from flexible AI-generated tags (for metadata/search).

## The Problem

Previously, the system used a single `tags` array for both navigation and metadata:
- **Inconsistent categories**: AI generated arbitrary tags, creating unpredictable filter options
- **Too many categories**: Each newsletter produced unique tags, cluttering the UI
- **No structure**: Users couldn't rely on stable categories for filtering their content

## The Solution

### 1. Structured Taxonomy Topics (for filtering/navigation)
**Field**: `nuggets.topic` (TEXT, NOT NULL)
**Source**: `user_settings.taxonomy_topics` (TEXT[], user-configurable)

**Default Topics**:
- AI & Machine Learning
- Social Media & Culture
- Business & Finance
- Tech Products & Innovation
- Climate & Energy
- Health & Science
- Policy & Regulation
- Startups & Funding

**Purpose**:
- Stable, predictable categories for FilterRail navigation
- User-defined and configurable in Settings
- Each nugget assigned EXACTLY ONE topic by AI
- Used for primary filtering and organization

**UI Display**: Bottom FilterRail with topic buttons showing counts

### 2. Flexible Tags (for metadata/search)
**Field**: `nuggets.tags` (TEXT[], still exists)
**Source**: AI-generated during extraction

**Examples**: `instagram`, `deepseek-r1`, `meta`, `openai-funding`, `adam-mosseri`

**Purpose**:
- Specific descriptive metadata (companies, products, people, technologies)
- Used for search functionality
- Visible on hover in nugget cards
- Good for future features (deduplication, semantic clustering)

**UI Display**: Hidden by default, shown on hover in nugget card

## How It Works

### 1. User Configuration
Users can customize their taxonomy topics in Settings:
```sql
UPDATE user_settings
SET taxonomy_topics = ARRAY[
  'AI & Machine Learning',
  'Product Development',
  'Climate Tech',
  'Health & Science'
]
WHERE user_id = 'xxx';
```

### 2. AI Extraction
When extracting nuggets, the AI receives:
- User's taxonomy topic list
- Instruction to select EXACTLY ONE topic from the list
- Instruction to generate 2-4 specific tags

**Example AI prompt section**:
```
TAXONOMY TOPICS (User's Interest Categories):
- AI & Machine Learning
- Social Media & Culture
- Business & Finance
[...]

You MUST assign exactly ONE taxonomy topic from the list above to each nugget.
```

**Expected JSON response**:
```json
{
  "nuggets": [
    {
      "title": "Instagram Declares the End of Aesthetic",
      "description": "...",
      "relevancy_score": 90,
      "topic": "Social Media & Culture",
      "tags": ["instagram", "adam-mosseri", "ai-content", "meta"]
    }
  ]
}
```

### 3. Database Storage
```sql
-- Nuggets table structure
CREATE TABLE nuggets (
  id UUID PRIMARY KEY,
  topic TEXT NOT NULL,  -- Single taxonomy topic
  tags TEXT[],           -- 2-4 AI-generated tags
  -- ... other fields
);

-- Index for fast topic filtering
CREATE INDEX idx_nuggets_topic ON nuggets(topic);
```

### 4. UI Filtering
**FilterRail** (bottom of page):
- Shows only taxonomy topics with counts
- Clean, predictable set of categories
- Color-coded by topic type
- Filters nuggets where `nugget.topic === selectedTopic`

**Search**:
- Searches across title, description, topic, AND tags
- Tags remain searchable even though not visible by default

## Benefits

✅ **Clean Navigation**: Predictable, stable topics in FilterRail
✅ **User Control**: Users define their own taxonomy
✅ **Powerful Metadata**: Specific tags still captured for search/future features
✅ **Better UX**: No cluttered filter UI with dozens of one-off categories
✅ **Scalability**: Taxonomy stays manageable as nuggets grow
✅ **Flexibility**: AI can still capture detailed metadata via tags

## Migration

Existing nuggets were backfilled with topics based on their tags:
```sql
UPDATE nuggets
SET topic = CASE
  WHEN 'AI' = ANY(tags) THEN 'AI & Machine Learning'
  WHEN 'Social Media' = ANY(tags) THEN 'Social Media & Culture'
  -- ...
  ELSE 'AI & Machine Learning'
END;
```

## Future Enhancements

1. **Taxonomy Management UI**: Allow users to add/edit/remove topics in Settings
2. **Topic Color Customization**: Let users choose colors for each topic
3. **Multi-Topic Support**: Allow nuggets to have 1-3 topics instead of just 1
4. **Smart Suggestions**: Suggest new taxonomy topics based on frequently-occurring tags
5. **Tag-based Features**: Use tags for deduplication, related nugget suggestions, trend detection
