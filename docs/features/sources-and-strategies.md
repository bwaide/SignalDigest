# Sources and Extraction Strategies System

## Overview

The Sources and Extraction Strategies system provides a flexible, user-controlled way to manage content sources (newsletters, RSS feeds, videos, etc.) and define how content should be extracted from each source type.

## Problem Statement

**Current Issues:**
1. Extraction strategies are hardcoded per newsletter (e.g., `RUNDOWN_AI_STRATEGY`)
2. No way to manage which sources are accepted/rejected
3. No visibility into source statistics (frequency, nugget yield, last seen)
4. Adding new newsletter types requires code changes
5. No framework for future non-email sources (RSS, videos, podcasts)

**Solution:**
- **Sources**: User-managed content providers with acceptance workflow
- **Strategy Types**: Pattern-based extraction approaches (not source-specific)
- **Flexible Assignment**: Users can assign strategies to sources
- **Future-Proof**: Designed for multiple source types beyond email

## Core Concepts

### 1. Sources

A **source** represents a content provider that generates signals (individual content items).

**Examples:**
- Email newsletter from `daily@therundown.ai`
- RSS feed from `https://news.ycombinator.com/rss`
- YouTube channel `@lexfridman`
- Podcast feed from Spotify

**Key Properties:**
- **Type**: `email`, `rss`, `youtube`, `podcast`, etc.
- **Identifier**: Unique string identifying the source (email address, URL, channel ID)
- **Display Name**: User-friendly name shown in UI
- **Status**: `pending`, `active`, `rejected`, `paused`
- **Extraction Strategy**: Which strategy to use for content extraction
- **Statistics**: Total signals, avg nuggets per signal, last seen timestamp

### 2. Extraction Strategy Types

Instead of newsletter-specific strategies, we define **pattern-based strategy types** that work for multiple sources with similar content structures.

#### Strategy Type: Ad-Heavy Link Listing

**Use Case**: Newsletters that curate links with brief descriptions, often contain sponsored sections

**Examples**: The Rundown AI, Morning Brew, TLDR Newsletter

**Extraction Approach:**
- Extract one nugget per link/item
- Heavy ad filtering (detect "SPONSORED", "TOGETHER WITH", etc.)
- Two nugget types:
  - **Main stories** (80-100 relevancy): Feature articles with "why it matters" analysis
  - **Link roundups** (60-80 relevancy): Brief news items in bullet lists
- Focus on filtering out promotional content
- Extract embedded URLs as primary content

**Configuration:**
```typescript
{
  strategyType: 'ad-heavy-link-listing',
  adDetection: {
    headerPatterns: ['SPONSORED', 'TOGETHER WITH', 'PARTNER CONTENT'],
    promotionalPhrases: ['limited time', 'buy now', 'sign up now'],
    skipSections: ['unsubscribe', 'manage preferences']
  },
  mainStories: {
    significanceMarker: 'Why it matters:',
    relevancyRange: [80, 100]
  },
  newsRoundup: {
    sectionHeaders: ['Everything else in', 'Quick hits', 'More news'],
    relevancyRange: [60, 80]
  }
}
```

#### Strategy Type: Long-form Deep Dive

**Use Case**: In-depth analysis articles, think pieces, comprehensive guides

**Examples**: Benedict Evans newsletter, Stratechery, Personal blog posts

**Extraction Approach:**
- Distill complex content into multiple comprehensive nuggets
- Each nugget captures a key argument/insight
- Longer nugget descriptions (150-300 chars)
- Extract section-by-section (introduction, main arguments, conclusion)
- High relevancy scores (75-95) due to curated, in-depth nature
- Preserve context and nuance

**Configuration:**
```typescript
{
  strategyType: 'long-form-deep-dive',
  sectionMarkers: ['##', '###', 'Key takeaway:', 'The bottom line:'],
  nuggetLength: 'comprehensive', // vs 'brief'
  relevancyRange: [75, 95],
  extractionMode: 'section-based', // Create nugget per major section
  preserveContext: true // Include surrounding context in description
}
```

#### Strategy Type: News Digest

**Use Case**: Structured news roundups with consistent formatting

**Examples**: Axios newsletters, The New Paper, Quartz Daily Brief

**Extraction Approach:**
- Each item is a standalone nugget
- Consistent formatting (usually numbered or bulleted)
- Brief, factual summaries
- Clear company/product names
- Medium relevancy (65-85)
- Minimal ad content (usually clean editorial)

**Configuration:**
```typescript
{
  strategyType: 'news-digest',
  itemFormat: 'numbered' | 'bulleted' | 'sections',
  itemMarkers: ['1.', '-', '•'],
  relevancyRange: [65, 85],
  extractionMode: 'per-item',
  titleFormat: 'company-action' // e.g., "Meta launches new AI tool"
}
```

#### Strategy Type: Generic/Default

**Use Case**: Unknown newsletter formats, fallback strategy

**Extraction Approach:**
- Conservative extraction (3-5 nuggets)
- Generic ad detection patterns
- Focus on headlines and summaries
- Medium relevancy (60-80)

### 3. Source Lifecycle

```
New Email Arrives
    ↓
Source Exists? ──No──→ Create Pending Source ──→ Notify User
    ↓                           ↓
   Yes                    User Reviews
    ↓                           ↓
Process Signal      Accept ←──────┴──────→ Reject
    ↓                ↓                      ↓
Extract Nuggets   Activate Source    Mark as Spam
    ↓                ↓                      ↓
Store in DB     Future emails          Future emails
              processed normally    moved to spam folder
```

**Pending Source Workflow:**
1. New email arrives from unknown sender
2. System creates source with `status: 'pending'`
3. Email is imported as signal but NOT processed (no nugget extraction yet)
4. User sees notification badge in header
5. User opens inbox → Modal shows pending sources
6. User reviews:
   - **Accept**: Source status → `active`, assigns extraction strategy, processes pending signals
   - **Reject**: Source status → `rejected`, deletes pending signals, future emails → spam

**Source Detection Logic (for emails):**
```typescript
// Combination of sender email + sender name for better matching
const sourceIdentifier = `${senderEmail}|${senderName}`

// Examples:
// "daily@therundown.ai|The Rundown"
// "newsletter@morningbrew.com|Morning Brew"
// "ben@stratechery.com|Ben Thompson"
```

## Database Schema

### `sources` Table

```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source identification
  source_type TEXT NOT NULL, -- 'email' | 'rss' | 'youtube' | 'podcast' | 'twitter' | ...
  identifier TEXT NOT NULL, -- email|name, URL, channel ID, etc.
  display_name TEXT NOT NULL, -- User-friendly name

  -- Extraction configuration
  extraction_strategy_id TEXT NOT NULL, -- References strategy type
  extraction_config JSONB, -- Strategy-specific configuration overrides

  -- Status and lifecycle
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'rejected' | 'paused'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signal_at TIMESTAMPTZ, -- Last time a signal was received from this source
  activated_at TIMESTAMPTZ, -- When user accepted the source

  -- Statistics (updated via triggers/functions)
  total_signals INTEGER DEFAULT 0,
  total_nuggets INTEGER DEFAULT 0,
  avg_nuggets_per_signal DECIMAL(5,2),

  -- Metadata (flexible JSON for source-type-specific data)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example metadata for email type:
  -- {
  --   "sender_email": "daily@therundown.ai",
  --   "sender_name": "The Rundown",
  --   "typical_subject_pattern": "AI news for %date%"
  -- }
  -- Example metadata for RSS type:
  -- {
  --   "feed_url": "https://news.ycombinator.com/rss",
  --   "feed_title": "Hacker News",
  --   "update_frequency": "hourly"
  -- }

  UNIQUE(user_id, source_type, identifier),
  CHECK (status IN ('pending', 'active', 'rejected', 'paused')),
  CHECK (source_type IN ('email', 'rss', 'youtube', 'podcast', 'twitter'))
);

-- Indexes
CREATE INDEX idx_sources_user_status ON sources(user_id, status);
CREATE INDEX idx_sources_type_status ON sources(source_type, status);
CREATE INDEX idx_sources_last_signal ON sources(last_signal_at DESC);

-- RLS Policies
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

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
```

### `signals` Table Update

Add `source_id` foreign key to link signals to sources:

```sql
ALTER TABLE signals
  ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

CREATE INDEX idx_signals_source ON signals(source_id);
```

### `extraction_strategies` Table (Optional Future Enhancement)

Store user-customizable strategies in database instead of code:

```sql
CREATE TABLE extraction_strategies (
  id TEXT PRIMARY KEY, -- 'ad-heavy-link-listing', 'long-form-deep-dive', etc.
  name TEXT NOT NULL,
  description TEXT,
  strategy_type TEXT NOT NULL,
  default_config JSONB NOT NULL,
  is_system BOOLEAN DEFAULT true, -- System-defined vs user-created
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (strategy_type IN ('ad-heavy-link-listing', 'long-form-deep-dive', 'news-digest', 'generic'))
);
```

## UI/UX Design

### Settings Page Redesign

**Current State**: Small overlay window with tabs

**New Design**: Full-page settings (like dashboard tabs)

**Route**: `/settings`

**Layout**:
```
┌─────────────────────────────────────────┐
│  [LOGO]  Settings     [Back to Inbox] ▶│ ← Header
├─────────────────────────────────────────┤
│ SOURCES | AUTO-SYNC | PREFERENCES       │ ← Tab Navigation
├─────────────────────────────────────────┤
│                                         │
│  Settings Content Area                  │
│                                         │
│  (Sources list, auto-sync config, etc.) │
│                                         │
└─────────────────────────────────────────┘
```

**Tab 1: SOURCES** (replaces current "Signals" tab)

Features:
- **Source Cards**: Each active source shown as a card
- **Statistics**: Total signals, avg nuggets, last seen, frequency estimate
- **Strategy Assignment**: Dropdown to change extraction strategy
- **Actions**: Pause, Delete, View Signals
- **Pagination**: 25 sources per page
- **Filters**: Active, Paused, Pending (separate tab?)

**Card Layout** (brutalist design):
```
┌────────────────────────────────────────────────┐
│ THE RUNDOWN AI                    [PAUSE] [×]  │ ← Source name, actions
├────────────────────────────────────────────────┤
│ daily@therundown.ai                            │ ← Identifier
│ Strategy: Ad-Heavy Link Listing ▼              │ ← Strategy selector
├────────────────────────────────────────────────┤
│ 142 signals | 8.3 nuggets/signal | Daily       │ ← Stats
│ Last seen: Jan 6, 2026 08:15 AM                │ ← Timestamp with time
└────────────────────────────────────────────────┘
```

**Tab 2: AUTO-SYNC** (existing auto-sync settings)

**Tab 3: PREFERENCES** (existing user settings)

### Pending Sources Modal

**Trigger**:
- Notification badge on header (shows count)
- Auto-opens when user visits inbox with pending sources

**Modal Design**:
```
┌─────────────────────────────────────────────────┐
│  NEW SOURCES DETECTED                       [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│  You have 2 new newsletter sources:            │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ MORNING BREW                              │ │
│  │ newsletter@morningbrew.com                │ │
│  │ First seen: Jan 6, 2026 09:30 AM          │ │
│  │                                           │ │
│  │ Strategy: News Digest ▼                   │ │ ← Auto-suggested
│  │                                           │ │
│  │         [ACCEPT]  [REJECT]                │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ AXIOS AI                                  │ │
│  │ newsletters@axios.com|Axios               │ │
│  │ First seen: Jan 5, 2026 07:15 AM          │ │
│  │                                           │ │
│  │ Strategy: Ad-Heavy Link Listing ▼         │ │
│  │                                           │ │
│  │         [ACCEPT]  [REJECT]                │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│            [REVIEW LATER]                       │
└─────────────────────────────────────────────────┘
```

**Actions**:
- **Accept**: Set `status: 'active'`, assign strategy, trigger nugget extraction for pending signals
- **Reject**: Set `status: 'rejected'`, delete pending signals, add to spam filter
- **Review Later**: Close modal, keep sources as pending

### Notification Badge

**Location**: Header, next to Settings icon

**Design**:
```
[⚙️ SETTINGS ③] ← Red badge with count
```

**Behavior**:
- Shows count of pending sources
- Clicking opens Settings → Sources tab with pending filter
- Badge persists until all pending sources are accepted/rejected

## Implementation Plan

### Phase 1: Database Schema (Foundation)

**Tasks**:
1. Create `sources` table migration
2. Add `source_id` to `signals` table
3. Create RLS policies for `sources`
4. Add database functions to update source statistics
5. Test locally with `supabase db reset`

**Deliverables**:
- Migration: `create_sources_table.sql`
- Migration: `add_source_id_to_signals.sql`

### Phase 2: Backend Logic (Source Detection & Management)

**Tasks**:
1. Update email import logic to detect/create sources
2. Implement source matching algorithm (email + name combo)
3. Add source acceptance/rejection endpoints
4. Update signal processing to check source status
5. Implement spam filtering for rejected sources
6. Add source statistics tracking (triggers or scheduled function)

**Files to Modify**:
- `app/api/emails/import/route.ts` - Source detection
- `app/api/cron/auto-sync/route.ts` - Source detection
- `app/api/sources/accept/route.ts` - NEW
- `app/api/sources/reject/route.ts` - NEW
- `app/api/sources/update/route.ts` - NEW (for strategy assignment)
- `app/api/sources/list/route.ts` - NEW (with pagination)

### Phase 3: Extraction Strategy Refactoring

**Tasks**:
1. Refactor `nugget-extraction-strategies.ts` to use strategy types instead of source-specific strategies
2. Create `AD_HEAVY_LINK_LISTING_STRATEGY`
3. Create `LONG_FORM_DEEP_DIVE_STRATEGY`
4. Create `NEWS_DIGEST_STRATEGY`
5. Update `GENERIC_STRATEGY`
6. Modify `getExtractionStrategy()` to accept strategy type + config
7. Update prompt generation to use generic strategies

**Files to Modify**:
- `lib/nugget-extraction-strategies.ts` - Major refactor
- `docs/nugget-extraction-strategies.md` - Update documentation

### Phase 4: Settings Page Redesign

**Tasks**:
1. Create `/settings` route (full page, not overlay)
2. Implement tab navigation (SOURCES, AUTO-SYNC, PREFERENCES)
3. Build Sources tab with pagination (25 per page)
4. Design source cards with brutalist styling
5. Add strategy selector dropdown
6. Display source statistics
7. Add timestamp with date AND time
8. Implement pause/delete actions
9. Migrate existing auto-sync and preferences content

**Files to Create**:
- `app/settings/page.tsx` - NEW
- `components/settings/SourceCard.tsx` - NEW
- `components/settings/SourcesList.tsx` - NEW
- `components/settings/SettingsTabs.tsx` - NEW

**Files to Modify**:
- `components/v2/CommandBar.tsx` - Update Settings button to link to `/settings`
- Remove old settings overlay components

### Phase 5: Pending Sources UI

**Tasks**:
1. Create pending sources modal component
2. Add notification badge to header
3. Implement auto-open on inbox visit
4. Build source preview cards with strategy selector
5. Wire up accept/reject actions
6. Add "Review Later" functionality
7. Update badge count in real-time

**Files to Create**:
- `components/sources/PendingSourcesModal.tsx` - NEW
- `components/sources/PendingSourceCard.tsx` - NEW
- `components/layout/NotificationBadge.tsx` - NEW

**Files to Modify**:
- `components/v2/CommandBar.tsx` - Add notification badge
- `components/v2/DashboardV2.tsx` - Auto-open modal logic

### Phase 6: Strategy Auto-Suggestion (AI Enhancement)

**Tasks**:
1. Analyze first email from pending source
2. Use AI to suggest appropriate strategy type
3. Provide confidence score
4. Allow user to override suggestion

**Implementation**:
- Add to email import flow
- Call AI Gateway with prompt: "Analyze this newsletter format and suggest extraction strategy type"
- Store suggestion in `sources.metadata.suggested_strategy`

### Phase 7: Testing & Migration

**Tasks**:
1. Test source detection with multiple newsletter types
2. Test pending source workflow
3. Test strategy assignment and switching
4. Migrate existing signals to sources (data migration script)
5. Test pagination
6. Test statistics accuracy
7. Load testing with 100+ sources

## Future Enhancements

### Multi-Source Types

Extend beyond email newsletters:

**RSS Feeds**:
```typescript
{
  source_type: 'rss',
  identifier: 'https://news.ycombinator.com/rss',
  extraction_strategy_id: 'news-digest',
  metadata: {
    feed_url: 'https://news.ycombinator.com/rss',
    update_frequency: 'hourly',
    last_fetch_at: '2026-01-06T10:00:00Z'
  }
}
```

**YouTube Channels**:
```typescript
{
  source_type: 'youtube',
  identifier: '@lexfridman',
  extraction_strategy_id: 'video-transcript-deep-dive',
  metadata: {
    channel_id: 'UCXXXxxxx',
    channel_name: 'Lex Fridman',
    avg_video_length: '7200' // seconds
  }
}
```

**Podcasts**:
```typescript
{
  source_type: 'podcast',
  identifier: 'https://feeds.simplecast.com/xyz',
  extraction_strategy_id: 'audio-transcript-highlights',
  metadata: {
    podcast_name: 'The Tim Ferriss Show',
    feed_url: 'https://feeds.simplecast.com/xyz'
  }
}
```

### User-Customizable Strategies

Allow users to create custom extraction strategies:

1. **Clone existing strategy** as template
2. **Edit configuration** (ad patterns, relevancy ranges, section markers)
3. **Test on sample content** before saving
4. **Version control** for strategy changes
5. **Share strategies** with other users (marketplace?)

### Machine Learning Strategy Optimization

Learn from user behavior to refine strategies:

- Track which nuggets users read/save/archive
- Adjust relevancy scoring based on engagement
- Refine ad detection patterns
- Suggest strategy improvements

### Source Groups/Collections

Organize sources into collections:

- "AI News" (Rundown AI, Import AI, TLDR AI)
- "Business News" (Morning Brew, Axios, Bloomberg)
- "Tech Deep Dives" (Stratechery, Benedict Evans, Dithering)

Apply bulk actions to collections.

## Success Metrics

**User Experience**:
- Time to accept/reject pending source: < 30 seconds
- Accuracy of auto-suggested strategies: > 80%
- Reduction in unwanted nuggets: > 50%

**System Performance**:
- Source detection accuracy: > 95%
- Nugget extraction quality (user feedback): > 4/5 stars
- Page load time for sources list: < 2 seconds

**Engagement**:
- % of users customizing strategies: Track adoption
- % of sources paused vs active: Monitor quality
- Source diversity per user: Track ecosystem growth

## Migration Path

**For Existing Users**:

1. **Auto-create sources** from existing signals
2. **Assign default strategies** based on current detection logic
3. **Mark all as active** (no pending workflow for historical data)
4. **Preserve signal history** (don't re-process)

**Migration Script**:
```sql
-- Create sources from existing signals
INSERT INTO sources (user_id, source_type, identifier, display_name, extraction_strategy_id, status, last_signal_at)
SELECT DISTINCT
  user_id,
  'email',
  source_identifier,
  SPLIT_PART(source_identifier, '|', 1) as display_name,
  'generic' as extraction_strategy_id, -- Default to generic
  'active',
  MAX(received_at)
FROM signals
WHERE source_identifier IS NOT NULL
GROUP BY user_id, source_identifier;

-- Link signals to sources
UPDATE signals s
SET source_id = src.id
FROM sources src
WHERE s.source_identifier = src.identifier
  AND s.user_id = src.user_id;
```

## Questions & Decisions

### Open Questions

1. **Strategy Configuration UI**: Should users edit raw JSON or use form inputs?
   - **Recommendation**: Form inputs for common settings, "Advanced" mode for JSON

2. **Source Deletion**: What happens to signals when source is deleted?
   - **Recommendation**: Soft delete source, keep signals with `source_id = NULL`

3. **Source Reactivation**: Can users reactivate rejected sources?
   - **Recommendation**: Yes, with confirmation modal

4. **Strategy Versioning**: Track strategy changes over time?
   - **Recommendation**: Phase 2 enhancement, not MVP

5. **Bulk Actions**: Accept/reject multiple pending sources at once?
   - **Recommendation**: Nice-to-have, add if users request

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Sources as separate table | Enables statistics, configuration, multi-source types |
| Pending workflow | Prevents spam, gives users control |
| Pattern-based strategies | More flexible than source-specific, easier to maintain |
| Strategy auto-suggestion | Reduces user effort, improves onboarding |
| Full-page settings | More space for complex configuration |
| 25 sources per page | Balances scrolling vs pagination clicks |

## References

- Original extraction strategies: `lib/nugget-extraction-strategies.ts`
- Strategy documentation: `docs/nugget-extraction-strategies.md`
- Database schema: `supabase/migrations/`
- Settings UI wireframes: (to be added)
