# Signal Digest

> Transform newsletter overload into a personalized, AI-curated news digest

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase CLI
- Supabase account (for production)

### Local Development

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/signal-digest.git
   cd signal-digest
   npm install
   ```

2. **Start Supabase:**
   ```bash
   supabase start
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Update with Supabase credentials from 'supabase start' output
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open dashboard:**
   Navigate to http://localhost:3000

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Coolify deployment instructions.

---

## Overview

Signal Digest is an AI-powered web application that transforms email newsletters into actionable, prioritized "nuggets" of information. Instead of drowning in unread newsletters, users get a personalized newspaper organized by topic with AI-ranked content.

**Current Focus:** Email newsletters (MVP)
**Future Vision:** Extensible to YouTube channels, social media feeds, RSS, podcasts, and other information sources

## Core Concept

- **Signals:** Information sources (newsletters, videos, posts, etc.)
- **Nuggets:** Extracted pieces of valuable information with title, description, relevancy score, tags, and links
- **Deduplication:** AI groups similar nuggets from different sources (like Google News)
- **Personalization:** Only show nuggets above a configurable relevancy threshold based on user interests

## Features

### MVP (Phase 1)
- ✅ Email newsletter processing via dedicated IMAP account
- ✅ AI extraction of multiple nuggets per email
- ✅ LLM-based relevancy scoring (0-100)
- ✅ LLM-based deduplication (7-day rolling window)
- ✅ Topic-based organization with 9 predefined topics
- ✅ Dashboard with priority-sorted sections
- ✅ Manual "Check now" trigger + scheduled auto-checks (every 6 hours)
- ✅ Read/unread tracking and archiving
- ✅ User notes on nuggets
- ✅ Error logging and retry logic

### Future Enhancements
- 🔮 Explicit topic preferences (keyword-based filtering)
- 🔮 Behavioral learning (track reading patterns to improve relevancy)
- 🔮 Additional signal sources (YouTube, social media, RSS, podcasts)
- 🔮 Embedding-based deduplication optimization
- 🔮 Multi-tenant SaaS capability
- 🔮 Mobile app

## Architecture

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React with TypeScript
- Tailwind CSS
- React Query (server state)
- Zustand (UI state)
- Supabase Client SDK

**Backend:**
- Supabase (PostgreSQL + Edge Functions)
- Supabase Vault (encrypted credential storage)
- pg_cron (scheduled tasks)
- Row Level Security (RLS) for data isolation

**External Services:**
- Custom AI Gateway (OpenAI-compatible API)
- IMAP email server (dedicated account for newsletters)

**Infrastructure:**
- Coolify (self-hosted PaaS on Hetzner)
- Nixpacks (automatic build detection)
- Automatic SSL, Nginx, Docker management

### System Flow

```
┌─────────────┐
│  Scheduled  │ ──┐
│  (pg_cron)  │   │
└─────────────┘   │
                  ├──> Edge Function: process-signals
┌─────────────┐   │
│   Manual    │   │
│   Trigger   │ ──┘
└─────────────┘
                  │
                  v
        ┌─────────────────┐
        │  Fetch Unread   │
        │  Emails (IMAP)  │
        └────────┬────────┘
                 │
                 v
        ┌─────────────────┐
        │  Extract Clean  │
        │  Content (MD)   │
        └────────┬────────┘
                 │
                 v
        ┌─────────────────┐
        │  AI Gateway:    │
        │  Extract Nuggets│
        └────────┬────────┘
                 │
                 v
        ┌─────────────────┐
        │  Store Nuggets  │
        │  & Signal       │
        └────────┬────────┘
                 │
                 v
        ┌─────────────────┐
        │  Deduplicate    │
        │  (7-day window) │
        └────────┬────────┘
                 │
                 v
        ┌─────────────────┐
        │  Mark Email     │
        │  Read & Archive │
        └─────────────────┘
                 │
                 v
        ┌─────────────────┐
        │  Dashboard      │
        │  Display        │
        └─────────────────┘
```

## Database Schema

### `signals` table
Stores raw information sources (emails, videos, posts, etc.)

```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('email', 'youtube', 'social_media', 'rss', 'podcast')),
  raw_content TEXT, -- Archived content (markdown for emails, transcript for video)
  title TEXT NOT NULL, -- Subject line / video title / post title
  source_identifier TEXT NOT NULL, -- Email address / channel name / account handle
  source_url TEXT, -- Link to original content
  received_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB, -- Flexible storage for signal-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_user_status ON signals(user_id, status, received_date);
```

### `nuggets` table
Stores extracted pieces of valuable information

```sql
CREATE TABLE nuggets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_id UUID REFERENCES signals NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT, -- Full extracted content for detail view
  link TEXT,
  source TEXT NOT NULL, -- Display name of newsletter/channel/feed
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

CREATE INDEX idx_nuggets_user_created ON nuggets(user_id, created_at DESC);
CREATE INDEX idx_nuggets_duplicate_group ON nuggets(duplicate_group_id);
CREATE INDEX idx_nuggets_tags ON nuggets USING GIN(tags);
```

### `user_settings` table
User preferences and configuration

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  interests_description TEXT, -- Natural language description of interests
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
```

### `processing_errors` table
Error tracking and debugging

```sql
CREATE TABLE processing_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES signals,
  error_type TEXT NOT NULL, -- 'network', 'llm', 'parsing', 'imap', etc.
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false
);
```

## Email Processing Pipeline

### 1. Trigger
- **Scheduled:** pg_cron runs every 6 hours (configurable)
- **Manual:** User clicks "Check for new emails" in dashboard
- Both invoke: `process-signals` Edge Function

### 2. Connect & Fetch (IMAP)
```typescript
// Retrieve credentials from Supabase Vault
const credentials = await getVaultSecret('imap_credentials');

// Connect to IMAP
const connection = await imapConnect({
  host: credentials.host,
  port: credentials.port,
  user: credentials.username,
  password: credentials.password,
  tls: true
});

// Fetch unread emails (limit 50 per run)
const emails = await connection.search(['UNSEEN'], { limit: 50 });

// Create signal records
for (const email of emails) {
  await supabase.from('signals').insert({
    signal_type: 'email',
    title: email.subject,
    source_identifier: email.from,
    received_date: email.date,
    status: 'pending'
  });
}
```

### 3. Content Extraction
```typescript
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Extract main content from HTML email
const doc = new DOMParser().parseFromString(htmlBody, 'text/html');
const reader = new Readability(doc);
const article = reader.parse();

// Convert to clean Markdown
const turndown = new TurndownService();
const markdown = turndown.turndown(article.content);

// Update signal with raw content
await supabase.from('signals').update({
  raw_content: markdown
}).eq('id', signalId);
```

### 4. AI Nugget Extraction
```typescript
// Call AI Gateway with structured prompt
const response = await fetch(AI_GATEWAY_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini', // Or your preferred model
    messages: [
      {
        role: 'system',
        content: 'You are an expert information curator extracting valuable insights from newsletters.'
      },
      {
        role: 'user',
        content: buildExtractionPrompt(markdown, userSettings)
      }
    ],
    response_format: { type: 'json_object' }
  })
});

const { nuggets } = await response.json();

// Store extracted nuggets
for (const nugget of nuggets) {
  await supabase.from('nuggets').insert({
    signal_id: signalId,
    user_id: userId,
    title: nugget.title,
    description: nugget.description,
    link: nugget.link,
    source: sourceIdentifier,
    published_date: nugget.published_date,
    relevancy_score: nugget.relevancy_score,
    tags: nugget.tags
  });
}
```

### 5. Deduplication
```typescript
// Fetch recent nuggets (7-day window) without duplicate_group_id
const recentNuggets = await supabase
  .from('nuggets')
  .select('*')
  .gte('created_at', sevenDaysAgo)
  .is('duplicate_group_id', null);

// Group by primary topic for batching
const batches = groupByPrimaryTopic(recentNuggets);

for (const batch of batches) {
  // Call AI Gateway for deduplication
  const dedupeResponse = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-4o', // More powerful model for reasoning
      messages: [
        {
          role: 'system',
          content: 'You are an expert at identifying duplicate news/information.'
        },
        {
          role: 'user',
          content: buildDeduplicationPrompt(batch)
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const { duplicate_groups } = await dedupeResponse.json();

  // Update nuggets with group assignments
  for (const group of duplicate_groups) {
    const groupId = crypto.randomUUID();

    for (const nuggetId of group.nugget_ids) {
      await supabase.from('nuggets').update({
        duplicate_group_id: groupId,
        is_primary: nuggetId === group.primary_nugget_id
      }).eq('id', nuggetId);
    }
  }
}
```

### 6. Post-Processing
```typescript
// Mark email as read and archive on IMAP server
await connection.addFlags(emailId, ['\\Seen']);
await connection.move(emailId, 'Archive');

// Update signal status
await supabase.from('signals').update({
  status: 'processed',
  processed_at: new Date().toISOString()
}).eq('id', signalId);
```

### Error Handling
```typescript
async function processWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Differentiate retryable vs permanent errors
      if (isRetryableError(error) && i < maxRetries - 1) {
        await sleep(2 ** i * 1000); // Exponential backoff
        continue;
      }

      // Log error
      await supabase.from('processing_errors').insert({
        signal_id: currentSignalId,
        error_type: classifyError(error),
        error_message: error.message,
        stack_trace: error.stack
      });

      // Mark signal as failed
      await supabase.from('signals').update({
        status: 'failed',
        error_message: error.message,
        retry_count: i + 1
      }).eq('id', currentSignalId);

      // Don't throw - continue processing other emails
      return null;
    }
  }
}

function isRetryableError(error) {
  return error.code === 'ETIMEDOUT' ||
         error.code === 'ECONNRESET' ||
         error.status === 429 || // Rate limit
         error.status >= 500; // Server errors
}
```

## AI Integration

### Extraction Prompt Template

```typescript
function buildExtractionPrompt(markdownContent: string, settings: UserSettings): string {
  return `Extract discrete pieces of valuable information ("nuggets") from this newsletter.

Newsletter Content:
${markdownContent}

User Interests:
${settings.interests_description}

Approved Topics:
${settings.approved_topics.join(', ')}

Instructions:
1. Identify each distinct piece of information, news, insight, or announcement
2. For each nugget, extract:
   - title: Clear, specific headline (5-10 words)
   - description: Concise summary (2-3 sentences, focus on value/implications)
   - link: URL for more information (extract from content)
   - tags: 1-3 tags from approved topics, or "Other" if no match
   - relevancy_score: 0-100 based on alignment with user interests
   - published_date: Date mentioned in content (or newsletter date if unclear)

3. Only extract genuinely valuable information (skip ads, boilerplate, unsubscribe links)
4. Each nugget should be independently useful

Response Format: JSON object with "nuggets" array

Example:
{
  "nuggets": [
    {
      "title": "Anthropic releases Claude 3.5 Sonnet",
      "description": "New model with improved coding capabilities and extended context window. Benchmarks show 20% improvement on complex reasoning tasks.",
      "link": "https://anthropic.com/news/claude-3-5",
      "tags": ["AI Development"],
      "relevancy_score": 95,
      "published_date": "2024-06-20T00:00:00Z"
    }
  ]
}`;
}
```

### Deduplication Prompt Template

```typescript
function buildDeduplicationPrompt(nuggets: Nugget[]): string {
  const nuggetsJson = JSON.stringify(nuggets.map(n => ({
    id: n.id,
    title: n.title,
    description: n.description,
    source: n.source,
    published_date: n.published_date
  })), null, 2);

  return `Analyze these nuggets and identify which ones are about the same story, announcement, or topic.

Nuggets:
${nuggetsJson}

Instructions:
- Group nuggets that are clearly about the same underlying story/event
- Different perspectives on the same event = duplicates
- Similar topics but different stories = NOT duplicates
- For each group, identify the nugget with the most comprehensive information as primary
- Provide confidence score (0.0-1.0) for each grouping
- Include brief reasoning for each group

Response Format: JSON object with "duplicate_groups" array

Example:
{
  "duplicate_groups": [
    {
      "confidence": 0.92,
      "nugget_ids": ["uuid-1", "uuid-2", "uuid-3"],
      "primary_nugget_id": "uuid-1",
      "reasoning": "All three nuggets are about the Claude 3.5 release. First nugget has most detail."
    }
  ]
}`;
}
```

## Dashboard UI

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Signal Digest              🔄 Check Now  ⚙️ Settings│
│  Last sync: 2 hours ago                             │
├─────────────────────────────────────────────────────┤
│  Sidebar              │  Main Content               │
│  ┌─────────────────┐  │  ┌──────────────────────┐  │
│  │ All Topics (42) │  │  │ AI Development (12)  │  │
│  │ AI Dev (12) ★   │  │  │ Sort: Priority ▾     │  │
│  │ AI Tools (8)    │  │  ├──────────────────────┤  │
│  │ Business (5)    │  │  │ ★★★ Claude 3.5...    │  │
│  │ Consulting (3)  │  │  │ Score: 95 • Today    │  │
│  │ ...             │  │  │ 2 sources ▾          │  │
│  │                 │  │  │ Description...       │  │
│  │ [Unread Only] ✓ │  │  │ [Read more →]        │  │
│  │ [Search...]     │  │  ├──────────────────────┤  │
│  └─────────────────┘  │  │ ★★ New GPT-4 API...  │  │
│                       │  │ Score: 88 • Yesterday│  │
└───────────────────────┴──┴──────────────────────────┘
```

### Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── CheckNowButton
│   ├── LastSyncIndicator
│   └── SettingsButton
├── Sidebar
│   ├── TopicList
│   ├── UnreadToggle
│   └── SearchBar
├── MainContent
│   └── TopicSection[] (repeated)
│       ├── SectionHeader
│       └── NuggetCard[]
│           ├── PriorityIndicator
│           ├── Title
│           ├── Metadata (score, date, sources)
│           ├── Description
│           ├── DuplicateSourcesList (expandable)
│           └── QuickActions (read, archive, note)
└── SettingsModal
    ├── InterestsTextarea
    ├── RelevancyThresholdSlider
    ├── TopicManager
    └── EmailCheckFrequency
```

### Key Features

**Nugget Card Interactions:**
- Click title/description → Open link in new tab
- Mark as read → Moves to "read" state, fades slightly
- Archive → Hides from view
- Add note → Quick inline textarea
- Expand duplicates → Shows all grouped sources

**Filtering:**
- Sidebar topic selection
- Unread/All toggle
- Search across titles and descriptions
- Date range (Today, This Week, This Month)

**Visual Priority Indicators:**
- ★★★ (90-100): High priority, bold text
- ★★ (75-89): Medium priority, normal text
- ★ (60-74): Lower priority, lighter text

**Responsive Design:**
- Desktop: Sidebar + main content side-by-side
- Tablet: Collapsible sidebar
- Mobile: Hamburger menu, single column, simplified cards

## Deployment

### Prerequisites
- Hetzner VPS with Coolify installed
- Supabase project created
- Custom AI Gateway accessible
- Domain name configured

### Supabase Setup

1. **Create Project:**
   ```bash
   # Via Supabase Dashboard or CLI
   supabase projects create signal-digest
   ```

2. **Run Migrations:**
   ```bash
   # Create migration files in supabase/migrations/
   # Apply via dashboard SQL editor or CLI
   supabase db push
   ```

3. **Configure Vault:**
   ```sql
   -- Store IMAP credentials
   SELECT vault.create_secret('imap_host', 'imap.example.com');
   SELECT vault.create_secret('imap_port', '993');
   SELECT vault.create_secret('imap_username', 'newsletters@example.com');
   SELECT vault.create_secret('imap_password', 'your-password');
   ```

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy process-signals
   supabase functions deploy deduplicate-nuggets
   ```

5. **Setup Scheduled Job:**
   ```sql
   SELECT cron.schedule(
     'process-emails',
     '0 */6 * * *',  -- Every 6 hours
     $$
     SELECT net.http_post(
       url:='https://[project-ref].supabase.co/functions/v1/process-signals',
       headers:='{"Authorization": "Bearer [service-role-key]"}'::jsonb
     )
     $$
   );
   ```

### Coolify Deployment

1. **Create New Project in Coolify:**
   - Source: GitHub repository
   - Build Pack: Nixpacks (auto-detected)
   - Branch: `main`
   - Auto-deploy: ✅ Enabled

2. **Environment Variables:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
   SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
   AI_GATEWAY_URL=https://your-gateway.com/v1/chat/completions
   AI_GATEWAY_API_KEY=[your-api-key]
   ```

3. **Deploy:**
   ```bash
   git push origin main
   # Coolify auto-builds and deploys
   ```

### Initial Setup After Deployment

1. **Create User Account:**
   - Navigate to deployed app
   - Sign up via Supabase Auth

2. **Configure Settings:**
   - Set interests description
   - Adjust relevancy threshold
   - Verify approved topics list

3. **Configure IMAP Account:**
   - Create dedicated email account
   - Subscribe to newsletters
   - Verify IMAP credentials in Supabase Vault

4. **Test Manual Trigger:**
   - Click "Check for new emails"
   - Monitor Edge Function logs
   - Verify nuggets appear in dashboard

## Development Workflow

### Local Development

1. **Clone Repository:**
   ```bash
   git clone https://github.com/yourusername/signal-digest.git
   cd signal-digest
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Start Local Supabase:**
   ```bash
   supabase start
   supabase db reset  # Apply migrations
   ```

4. **Configure Local Environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with local Supabase credentials
   ```

5. **Run Development Server:**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

6. **Develop Edge Functions:**
   ```bash
   supabase functions serve process-signals
   # Test locally before deploying
   ```

### Testing Strategy

1. **Unit Tests:**
   - Content extraction logic
   - Prompt building functions
   - Error handling utilities

2. **Integration Tests:**
   - IMAP connection and email fetching
   - AI Gateway API calls
   - Database operations

3. **E2E Tests:**
   - Full pipeline: email → nuggets → dashboard
   - User interactions (mark read, archive, etc.)
   - Settings management

## Next Steps for Implementation

### Phase 1: Core Infrastructure (Week 1)
1. Initialize Next.js project with TypeScript
2. Set up Supabase project and database schema
3. Configure Supabase Auth
4. Create basic dashboard layout (empty state)
5. Set up Coolify deployment pipeline

### Phase 2: Email Processing (Week 2)
1. Implement IMAP connection logic
2. Build content extraction pipeline (HTML → Markdown)
3. Create AI Gateway integration
4. Implement nugget extraction with structured prompts
5. Build Edge Function for `process-signals`
6. Test with sample newsletters

### Phase 3: Deduplication & Refinement (Week 3)
1. Implement deduplication logic
2. Create `deduplicate-nuggets` Edge Function
3. Test grouping accuracy with real data
4. Refine prompts based on results
5. Add error handling and retry logic

### Phase 4: Dashboard UI (Week 4)
1. Build topic-based section components
2. Implement nugget cards with all features
3. Add filtering and search
4. Create settings modal
5. Implement read/archive/notes functionality
6. Polish responsive design

### Phase 5: Automation & Polish (Week 5)
1. Configure pg_cron for scheduled checks
2. Implement manual trigger button
3. Add processing error dashboard
4. Performance optimization
5. User testing and feedback
6. Documentation and deployment guide

## Cost Estimates

### Monthly Operating Costs
- **Hetzner VPS (CX21):** €4.90/month
- **Supabase Free Tier:** €0 (sufficient for single user)
- **AI Gateway (estimated):** $10-20/month
  - Extraction: ~$5-10/month (assuming 100 emails/day with GPT-4o-mini)
  - Deduplication: ~$5-10/month (GPT-4o for reasoning)
- **Domain & SSL:** €0 (Let's Encrypt free, domain assumed existing)

**Total:** ~€15-25/month (~$16-27/month)

### Scaling Costs (Future Multi-Tenant)
- **Supabase Pro:** $25/month (for higher limits)
- **Larger VPS:** €10-20/month
- **AI costs scale linearly with users:** ~$10-20/user/month

## Security Considerations

1. **Credential Storage:**
   - IMAP credentials in Supabase Vault (encrypted)
   - Environment variables for API keys
   - Never commit secrets to git

2. **Data Access:**
   - Row Level Security (RLS) on all tables
   - User can only access their own data
   - Service role key only in server-side code

3. **Email Security:**
   - Use dedicated email account (not personal)
   - App-specific password if available
   - TLS/SSL for IMAP connection

4. **API Security:**
   - Rate limiting on Edge Functions
   - API key authentication for AI Gateway
   - CORS configuration for frontend

## Future Enhancements

### Near-term
- **Email rule management:** Whitelist/blacklist senders
- **Export functionality:** Download nuggets as PDF/CSV
- **Sharing:** Share interesting nuggets via link
- **Digest emails:** Daily/weekly summary via email
- **Browser extension:** Save web articles as signals

### Long-term
- **Additional signal sources:**
  - YouTube channels (transcripts)
  - Twitter/X feeds
  - Reddit subscriptions
  - RSS feeds
  - Podcast transcripts

- **Advanced AI features:**
  - Topic trend analysis
  - Automatic topic discovery
  - Sentiment analysis
  - Entity extraction and linking

- **Collaboration:**
  - Team accounts with shared digests
  - Curated public collections
  - Commenting and discussions

## License

TBD (To be determined by project owner)

## Support

For questions or issues during implementation, refer to:
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Design specification: `docs/plans/2025-12-30-signal-digest-design.md`
