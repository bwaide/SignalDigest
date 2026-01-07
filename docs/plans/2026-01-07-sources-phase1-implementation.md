# Sources and Strategies - Phase 1 Implementation Plan

**Date**: January 7, 2026
**Status**: Ready for Implementation
**Phase**: 1 of 2 (Database + Basic UI)

## Overview

This document outlines the implementation plan for Phase 1 of the Sources and Strategies system. Phase 1 establishes the database foundation, basic API endpoints, and full-featured UI for source management, while deferring the extraction strategy refactoring to Phase 2.

## Scope

### In Scope (Phase 1)
- ✅ `sources` table with RLS policies
- ✅ Migration of existing signals to sources (all marked as `active`)
- ✅ Source detection in email import (creates `pending` sources)
- ✅ Accept/reject workflow for pending sources
- ✅ Full-page Settings redesign with brutalist design
- ✅ Source management UI with pagination (25 per page)
- ✅ Strategy dropdown (placeholder - selection stored but not used yet)
- ✅ Notification badge for pending sources
- ✅ Spam filtering for rejected sources

### Out of Scope (Phase 2)
- ❌ Extraction strategy refactoring (pattern-based strategies)
- ❌ Actually using `extraction_strategy_id` in nugget extraction
- ❌ Source statistics (total signals, avg nuggets, frequency)
- ❌ Advanced strategy configuration UI
- ❌ AI-powered strategy auto-suggestion
- ❌ Non-email source types (RSS, YouTube, etc.)

## Design Decisions

### Decision Log

| Decision | Rationale |
|----------|-----------|
| **Database-first implementation** | Solid foundation, easier to test incrementally |
| **Migrate existing data** | Preserve production signals, maintain history |
| **Immediate pending workflow** | Feature works right after deployment |
| **Two-phase strategy implementation** | Smaller scope, less risk, keep extraction working |
| **Full Settings redesign now** | Complete user experience, no throwaway UI code |
| **Defer statistics to Phase 2** | Focus on core workflow, add metrics later |
| **Use auto-sync polling for badge** | Leverage existing 15-min polling, avoid extra requests |
| **Strategy dropdown is placeholder** | UI ready for Phase 2, doesn't affect extraction yet |

### Key Constraints

- Keep existing nugget extraction working throughout Phase 1
- Preserve all existing signals and their data
- No breaking changes to current user workflows
- Mobile-responsive brutalist design matching existing components

## Database Schema

### New Table: `sources`

```sql
CREATE TABLE sources (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source identification
  source_type TEXT NOT NULL DEFAULT 'email',
  identifier TEXT NOT NULL,  -- Format: "email@domain.com|Sender Name"
  display_name TEXT NOT NULL,

  -- Extraction configuration (Phase 2)
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

-- Indexes
CREATE INDEX idx_sources_user_status ON sources(user_id, status);
CREATE INDEX idx_sources_type_status ON sources(source_type, status);

-- RLS Policies
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sources"
  ON sources FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sources"
  ON sources FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources"
  ON sources FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources"
  ON sources FOR DELETE USING (auth.uid() = user_id);
```

**Field Descriptions**:

- `identifier`: Unique source identifier. For emails: `"email@domain.com|Sender Name"`. Future: RSS URLs, YouTube channel IDs, etc.
- `display_name`: User-friendly name shown in UI (extracted from sender name or customizable)
- `extraction_strategy_id`: Strategy to use for extraction. Phase 1 values: `'generic'`, `'ad-heavy-link-listing'`, `'long-form-deep-dive'`, `'news-digest'`. Phase 2 will actually use these.
- `status`:
  - `pending`: New source awaiting user acceptance
  - `active`: Accepted source, emails are processed
  - `rejected`: User rejected, emails moved to spam
  - `paused`: User paused, emails imported but not processed
- `last_signal_at`: Timestamp of most recent signal received (updated on every email import)
- `activated_at`: When user accepted the source (null for pending)
- `metadata`: Flexible JSONB for source-type-specific data without schema changes

### Update Table: `signals`

```sql
-- Add foreign key to sources
ALTER TABLE signals
  ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_signals_source ON signals(source_id);
```

**Migration Strategy**:
- `source_id` is nullable (existing signals will be linked via migration)
- `ON DELETE SET NULL` preserves signals if source is deleted
- Keep existing `source_identifier` field for backward compatibility

## Migration Scripts

### Migration 1: `20260107_create_sources_table.sql`

```sql
-- Create sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'email',
  identifier TEXT NOT NULL,
  display_name TEXT NOT NULL,
  extraction_strategy_id TEXT NOT NULL DEFAULT 'generic',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signal_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(user_id, source_type, identifier),
  CHECK (status IN ('pending', 'active', 'rejected', 'paused')),
  CHECK (source_type IN ('email', 'rss', 'youtube', 'podcast', 'twitter'))
);

-- Indexes
CREATE INDEX idx_sources_user_status ON sources(user_id, status);
CREATE INDEX idx_sources_type_status ON sources(source_type, status);

-- RLS Policies
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sources"
  ON sources FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sources"
  ON sources FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources"
  ON sources FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources"
  ON sources FOR DELETE USING (auth.uid() = user_id);

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
  -- Extract display name from identifier
  COALESCE(
    SPLIT_PART(source_identifier, '|', 2),  -- Use sender name if available
    SPLIT_PART(source_identifier, '@', 1)   -- Fallback to email username
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
```

**Migration Notes**:
- Creates sources from existing `signals.source_identifier`
- All migrated sources marked as `active` (preserves current behavior)
- `display_name` extracted from identifier or email address
- `last_signal_at` set to most recent signal timestamp
- Handles duplicates with `ON CONFLICT DO NOTHING`

### Migration 2: `20260107_add_source_id_to_signals.sql`

```sql
-- Add source_id column to signals
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
```

**Migration Notes**:
- Links existing signals to newly created sources
- Uses `source_identifier` to match signals with sources
- Only updates signals that haven't been linked yet (idempotent)
- Index speeds up queries like "get all signals for source X"

## API Endpoints

### 1. List Sources

**Endpoint**: `GET /api/sources/list`

**Query Parameters**:
- `status` (optional): Filter by status (`active`, `pending`, `paused`, `rejected`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25, max: 100)

**Response**:
```json
{
  "sources": [
    {
      "id": "uuid",
      "display_name": "The Rundown AI",
      "identifier": "daily@therundown.ai|The Rundown",
      "extraction_strategy_id": "generic",
      "status": "active",
      "last_signal_at": "2026-01-07T10:30:00Z",
      "created_at": "2025-12-20T08:00:00Z",
      "activated_at": "2025-12-20T08:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 42,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Implementation**:
```typescript
export async function GET(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
  const offset = (page - 1) * limit

  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('sources')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.userId)
    .order('last_signal_at', { ascending: false, nullsFirst: false })

  if (status) {
    query = query.eq('status', status)
  }

  // Execute with pagination
  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    sources: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasNext: offset + limit < (count || 0),
      hasPrev: page > 1
    }
  })
}
```

### 2. Get Pending Count

**Endpoint**: `GET /api/sources/pending-count`

**Response**:
```json
{
  "count": 3
}
```

**Implementation**:
```typescript
export async function GET(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count || 0 })
}
```

### 3. Accept Source

**Endpoint**: `POST /api/sources/accept`

**Request Body**:
```json
{
  "source_id": "uuid",
  "extraction_strategy_id": "ad-heavy-link-listing"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Source activated",
  "processed_signals": 3
}
```

**Implementation**:
```typescript
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const body = await request.json()
  const { source_id, extraction_strategy_id } = body

  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  // Update source status
  const { data: source, error: updateError } = await supabase
    .from('sources')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      ...(extraction_strategy_id && { extraction_strategy_id })
    })
    .eq('id', source_id)
    .eq('user_id', auth.userId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Process pending signals from this source
  const { data: pendingSignals } = await supabase
    .from('signals')
    .select('id')
    .eq('source_id', source_id)
    .eq('status', 'pending')

  let processedCount = 0
  if (pendingSignals) {
    for (const signal of pendingSignals) {
      // Trigger nugget extraction for each pending signal
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/signals/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signal.id })
      })
      processedCount++
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Source activated',
    processed_signals: processedCount
  })
}
```

### 4. Reject Source

**Endpoint**: `POST /api/sources/reject`

**Request Body**:
```json
{
  "source_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Source rejected",
  "deleted_signals": 5
}
```

**Implementation**:
```typescript
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const body = await request.json()
  const { source_id } = body

  const supabase = await createClient()

  // Update source status
  const { error: updateError } = await supabase
    .from('sources')
    .update({ status: 'rejected' })
    .eq('id', source_id)
    .eq('user_id', auth.userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Delete pending signals from this source
  const { data: deletedSignals, error: deleteError } = await supabase
    .from('signals')
    .delete()
    .eq('source_id', source_id)
    .eq('status', 'pending')
    .select()

  if (deleteError) {
    console.error('Error deleting signals:', deleteError)
  }

  return NextResponse.json({
    success: true,
    message: 'Source rejected',
    deleted_signals: deletedSignals?.length || 0
  })
}
```

### 5. Update Source

**Endpoint**: `POST /api/sources/update`

**Request Body**:
```json
{
  "source_id": "uuid",
  "status": "paused",  // optional: "active" | "paused"
  "extraction_strategy_id": "news-digest",  // optional
  "display_name": "Custom Name"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Source updated"
}
```

**Implementation**:
```typescript
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const body = await request.json()
  const { source_id, status, extraction_strategy_id, display_name } = body

  // Build update object
  const updates: any = {}
  if (status && ['active', 'paused'].includes(status)) {
    updates.status = status
  }
  if (extraction_strategy_id) {
    updates.extraction_strategy_id = extraction_strategy_id
  }
  if (display_name) {
    updates.display_name = display_name
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('sources')
    .update(updates)
    .eq('id', source_id)
    .eq('user_id', auth.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Source updated'
  })
}
```

### 6. Delete Source

**Endpoint**: `POST /api/sources/delete`

**Request Body**:
```json
{
  "source_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Source deleted"
}
```

**Implementation**:
```typescript
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error

  const body = await request.json()
  const { source_id } = body

  const supabase = await createClient()

  // Soft delete: update status to rejected
  const { error } = await supabase
    .from('sources')
    .update({ status: 'rejected' })
    .eq('id', source_id)
    .eq('user_id', auth.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Source deleted'
  })
}
```

**Note**: We use soft delete (status = 'rejected') to preserve signals. Hard delete would set all `signals.source_id` to NULL due to `ON DELETE SET NULL`.

## Email Import Logic

### Source Detection Flow

Both `/api/emails/import` and `/api/cron/auto-sync` need to detect and handle sources:

```typescript
// For each email fetched from IMAP:

// 1. Build source identifier from email metadata
const senderEmail = email.from[0].address.toLowerCase()
const senderName = email.from[0].name || senderEmail.split('@')[0]
const sourceIdentifier = `${senderEmail}|${senderName}`

// 2. Check if source exists
const { data: existingSource, error: sourceError } = await supabase
  .from('sources')
  .select('id, status, extraction_strategy_id')
  .eq('user_id', userId)
  .eq('source_type', 'email')
  .eq('identifier', sourceIdentifier)
  .maybeSingle()

// 3. Handle based on source status
if (!existingSource) {
  // NEW SOURCE: Create as pending
  console.log(`New source detected: ${senderName} (${senderEmail})`)

  const { data: newSource, error: createError } = await supabase
    .from('sources')
    .insert({
      user_id: userId,
      source_type: 'email',
      identifier: sourceIdentifier,
      display_name: senderName,
      status: 'pending',
      extraction_strategy_id: 'generic',
      last_signal_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (createError || !newSource) {
    console.error('Failed to create source:', createError)
    continue
  }

  // Import signal but DON'T process (no nugget extraction)
  const signalId = await createSignal(email, newSource.id, userId)

  console.log(`Created pending signal ${signalId} for pending source`)

  // Mark email as SEEN to prevent re-import
  await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })
  continue

} else if (existingSource.status === 'rejected') {
  // REJECTED SOURCE: Skip email and mark as spam
  console.log(`Skipping rejected source: ${senderName}`)

  await connection.messageFlagsAdd(email.uid, ['\\Deleted'], { uid: true })
  continue

} else if (existingSource.status === 'active') {
  // ACTIVE SOURCE: Normal processing flow
  console.log(`Processing email from active source: ${senderName}`)

  const signalId = await createSignal(email, existingSource.id, userId)

  // Trigger nugget extraction
  await processSignal(signalId, userId)

  // Update last_signal_at timestamp
  await supabase
    .from('sources')
    .update({ last_signal_at: new Date().toISOString() })
    .eq('id', existingSource.id)

  // Mark email as processed
  await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })

} else if (existingSource.status === 'paused') {
  // PAUSED SOURCE: Import but don't process
  console.log(`Importing from paused source: ${senderName}`)

  const signalId = await createSignal(email, existingSource.id, userId)

  // Update last_signal_at but don't process
  await supabase
    .from('sources')
    .update({ last_signal_at: new Date().toISOString() })
    .eq('id', existingSource.id)

  await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })
}
```

### Key Behaviors

| Source Status | Email Handling | Signal Created | Nuggets Extracted | Email Marked |
|---------------|----------------|----------------|-------------------|--------------|
| **Not Found** | Create pending source | Yes (status: pending) | No | SEEN |
| **Pending** | Skip (already have signal) | No | No | - |
| **Active** | Normal processing | Yes (status: pending) | Yes | SEEN |
| **Paused** | Import only | Yes (status: pending) | No | SEEN |
| **Rejected** | Delete email | No | No | DELETED |

### Auto-Sync Response Update

Update `/api/cron/auto-sync` response to include pending count:

```typescript
// At end of auto-sync processing:

// Get pending sources count
const { count: pendingCount } = await supabase
  .from('sources')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('status', 'pending')

return NextResponse.json({
  success: true,
  imported: importedCount,
  processed: processedCount,
  pending_sources_count: pendingCount || 0  // Add this
})
```

Frontend can read this and update the notification badge.

## UI Components

### Route Structure

```
app/
├── settings/
│   └── page.tsx              # Main settings page
components/
├── settings/
│   ├── SettingsLayout.tsx    # Tab navigation wrapper
│   ├── SourcesTab.tsx        # Sources list with pagination
│   ├── SourceCard.tsx        # Individual source card
│   ├── AutoSyncTab.tsx       # Migrate existing auto-sync
│   └── PreferencesTab.tsx    # Migrate existing preferences
└── sources/
    ├── PendingSourcesModal.tsx   # Accept/reject modal
    └── NotificationBadge.tsx     # Pending count badge
```

### Settings Page Layout

**File**: `app/settings/page.tsx`

```typescript
'use client'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SourcesTab } from '@/components/settings/SourcesTab'
import { AutoSyncTab } from '@/components/settings/AutoSyncTab'
import { PreferencesTab } from '@/components/settings/PreferencesTab'
import { useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'sources'

  return (
    <SettingsLayout activeTab={activeTab}>
      {activeTab === 'sources' && <SourcesTab />}
      {activeTab === 'auto-sync' && <AutoSyncTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
    </SettingsLayout>
  )
}
```

**Design**:
```
┌──────────────────────────────────────────────┐
│ [LOGO] Settings          [Back to Inbox] ▶  │ ← Header
├──────────────────────────────────────────────┤
│ SOURCES | AUTO-SYNC | PREFERENCES            │ ← Tabs
├──────────────────────────────────────────────┤
│                                              │
│  [Tab Content Area]                          │
│                                              │
└──────────────────────────────────────────────┘
```

### Settings Layout Component

**File**: `components/settings/SettingsLayout.tsx`

```typescript
'use client'

import { useRouter } from 'next/navigation'

interface Tab {
  id: string
  label: string
}

const TABS: Tab[] = [
  { id: 'sources', label: 'SOURCES' },
  { id: 'auto-sync', label: 'AUTO-SYNC' },
  { id: 'preferences', label: 'PREFERENCES' }
]

export function SettingsLayout({
  activeTab,
  children
}: {
  activeTab: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-2 border-black">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display font-black text-2xl">SETTINGS</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white border-2 border-black hover:bg-black hover:text-white font-display font-black text-sm transition-colors"
          >
            BACK TO INBOX ▶
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="fixed top-[69px] md:top-[84px] left-0 right-0 z-40 bg-white border-b-2 border-black/10">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(`/settings?tab=${tab.id}`)}
              className={`flex-1 md:flex-none md:px-6 py-3 font-display font-black text-sm transition-all border-r-2 border-black/10 ${
                activeTab === tab.id
                  ? 'bg-[hsl(var(--electric-blue))] text-white'
                  : 'bg-white text-black hover:bg-black/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <main className="pt-[129px] md:pt-[136px] px-4 md:px-6 pb-32 max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}
```

**Brutalist Design Elements**:
- Thick `border-2 border-black` on all elements
- Active tab: `bg-[hsl(var(--electric-blue))]` (electric blue)
- Hover states: `hover:bg-black/5`
- `font-display font-black` for all text
- Fixed positioning with proper `pt-[]` spacing

### Sources Tab Component

**File**: `components/settings/SourcesTab.tsx`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { SourceCard } from './SourceCard'

type SourceStatus = 'all' | 'active' | 'pending' | 'paused'

export function SourcesTab() {
  const [status, setStatus] = useState<SourceStatus>('all')
  const [page, setPage] = useState(1)
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['sources', status, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      if (status !== 'all') {
        params.set('status', status)
      }

      const res = await fetch(`/api/sources/list?${params}`)
      if (!res.ok) throw new Error('Failed to fetch sources')
      return res.json()
    }
  })

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'pending', 'paused'] as SourceStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={`px-4 py-2 border-2 border-black font-display font-black text-sm transition-colors ${
              status === s
                ? 'bg-[hsl(var(--electric-blue))] text-white'
                : 'bg-white hover:bg-black hover:text-white'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Sources List */}
      {isLoading ? (
        <div className="text-center py-12">Loading sources...</div>
      ) : data?.sources.length === 0 ? (
        <div className="text-center py-12 border-2 border-black p-8">
          <p className="font-display font-black text-lg">NO SOURCES YET</p>
          <p className="text-sm mt-2">Sources will appear here when emails are imported</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.sources.map((source: any) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!data.pagination.hasPrev}
            className="px-6 py-2 border-2 border-black font-display font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
          >
            ◄ PREV
          </button>

          <div className="flex gap-2">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 border-2 border-black font-display font-black ${
                  p === page
                    ? 'bg-[hsl(var(--electric-blue))] text-white'
                    : 'bg-white hover:bg-black hover:text-white'
                } transition-colors`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage(page + 1)}
            disabled={!data.pagination.hasNext}
            className="px-6 py-2 border-2 border-black font-display font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
          >
            NEXT ►
          </button>
        </div>
      )}

      <div className="text-center text-sm text-gray-600">
        Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, data?.pagination.total || 0)} of {data?.pagination.total || 0} sources
      </div>
    </div>
  )
}
```

**Features**:
- Filter buttons: ALL, ACTIVE, PENDING, PAUSED
- Pagination controls (25 per page)
- Empty state messaging
- React Query for caching and refetching

### Source Card Component

**File**: `components/settings/SourceCard.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Source {
  id: string
  display_name: string
  identifier: string
  extraction_strategy_id: string
  status: string
  last_signal_at: string | null
  created_at: string
}

const STRATEGIES = [
  { id: 'generic', label: 'Generic' },
  { id: 'ad-heavy-link-listing', label: 'Ad-Heavy Link Listing' },
  { id: 'long-form-deep-dive', label: 'Long-form Deep Dive' },
  { id: 'news-digest', label: 'News Digest' }
]

export function SourceCard({ source }: { source: Source }) {
  const queryClient = useQueryClient()
  const [strategy, setStrategy] = useState(source.extraction_strategy_id)

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch('/api/sources/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id, ...updates })
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sources/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id })
      })
      if (!res.ok) throw new Error('Delete failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
    }
  })

  const togglePause = () => {
    const newStatus = source.status === 'active' ? 'paused' : 'active'
    updateMutation.mutate({ status: newStatus })
  }

  const handleStrategyChange = (newStrategy: string) => {
    setStrategy(newStrategy)
    updateMutation.mutate({ extraction_strategy_id: newStrategy })
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(timestamp))
  }

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-black">
        <h3 className="font-display font-black text-lg">{source.display_name}</h3>
        <div className="flex gap-2">
          <button
            onClick={togglePause}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors"
            title={source.status === 'active' ? 'Pause' : 'Resume'}
          >
            {source.status === 'active' ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete source "${source.display_name}"?`)) {
                deleteMutation.mutate()
              }
            }}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-red-500 hover:text-white transition-colors"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {/* Identifier */}
      <div className="px-4 py-3 border-b-2 border-black text-sm">
        {source.identifier}
      </div>

      {/* Strategy Selector */}
      <div className="px-4 py-3 border-b-2 border-black">
        <label className="block text-sm font-bold mb-2">Strategy:</label>
        <select
          value={strategy}
          onChange={(e) => handleStrategyChange(e.target.value)}
          className="w-full px-4 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="text-xs mt-2 text-gray-600">
          Strategy selection will be used in Phase 2
        </p>
      </div>

      {/* Timestamp */}
      <div className="px-4 py-3 text-sm">
        Last seen: <span className="font-bold">{formatTimestamp(source.last_signal_at)}</span>
      </div>
    </div>
  )
}
```

**Brutalist Design**:
- `border-2 border-black` on all sections
- Icon buttons: `w-10 h-10` with hover states
- Electric blue focus ring on dropdown
- Clean typography with `font-display font-black`

### Pending Sources Modal

**File**: `components/sources/PendingSourcesModal.tsx`

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export function PendingSourcesModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: pendingSources } = useQuery({
    queryKey: ['sources', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/sources/list?status=pending')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      return data.sources
    },
    enabled: isOpen
  })

  const acceptMutation = useMutation({
    mutationFn: async ({ sourceId, strategyId }: { sourceId: string; strategyId: string }) => {
      const res = await fetch('/api/sources/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, extraction_strategy_id: strategyId })
      })
      if (!res.ok) throw new Error('Accept failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await fetch('/api/sources/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId })
      })
      if (!res.ok) throw new Error('Reject failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  if (!isOpen || !pendingSources || pendingSources.length === 0) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white border-4 border-black max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-2xl">NEW SOURCES DETECTED</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm">
            You have {pendingSources.length} new newsletter source{pendingSources.length > 1 ? 's' : ''}:
          </p>

          {pendingSources.map((source: any) => (
            <PendingSourceCard
              key={source.id}
              source={source}
              onAccept={(strategyId) => acceptMutation.mutate({ sourceId: source.id, strategyId })}
              onReject={() => rejectMutation.mutate(source.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-black text-center">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-black font-display font-black hover:bg-black hover:text-white transition-colors"
          >
            REVIEW LATER
          </button>
        </div>
      </div>
    </div>
  )
}

function PendingSourceCard({
  source,
  onAccept,
  onReject
}: {
  source: any
  onAccept: (strategyId: string) => void
  onReject: () => void
}) {
  const [strategy, setStrategy] = useState('generic')

  return (
    <div className="border-2 border-black p-4 space-y-4">
      <div>
        <h3 className="font-display font-black text-lg">{source.display_name}</h3>
        <p className="text-sm text-gray-600">{source.identifier}</p>
        <p className="text-xs text-gray-500 mt-1">
          First seen: {new Date(source.created_at).toLocaleString()}
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold mb-2">Strategy:</label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="w-full px-4 py-2 border-2 border-black bg-white"
        >
          <option value="generic">Generic</option>
          <option value="ad-heavy-link-listing">Ad-Heavy Link Listing</option>
          <option value="long-form-deep-dive">Long-form Deep Dive</option>
          <option value="news-digest">News Digest</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(strategy)}
          className="flex-1 px-6 py-3 bg-[hsl(var(--electric-blue))] text-white border-2 border-black font-display font-black hover:bg-black transition-colors"
        >
          ACCEPT
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-6 py-3 bg-white border-2 border-black font-display font-black hover:bg-red-500 hover:text-white transition-colors"
        >
          REJECT
        </button>
      </div>
    </div>
  )
}
```

**Modal Behavior**:
- Auto-opens when user visits dashboard with pending sources
- Shows all pending sources with accept/reject buttons
- Strategy selector (defaults to 'generic')
- "Review Later" closes without action
- Updates pending count after actions

### Notification Badge

**File**: `components/sources/NotificationBadge.tsx`

Add to CommandBar:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

export function NotificationBadge() {
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const res = await fetch('/api/sources/pending-count')
      if (!res.ok) return { count: 0 }
      return res.json()
    },
    refetchInterval: 900000 // 15 minutes (matches auto-sync)
  })

  const count = data?.count || 0

  if (count === 0) return null

  return (
    <button
      onClick={() => router.push('/settings?tab=sources&filter=pending')}
      className="relative px-4 py-2 bg-white border-2 border-black hover:bg-black hover:text-white font-display font-black text-sm transition-colors"
    >
      ⚙️ SETTINGS
      <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-black">
        {count}
      </span>
    </button>
  )
}
```

**Integration in CommandBar**:
```typescript
// Replace existing Settings button with NotificationBadge
<NotificationBadge />
```

**Badge Behavior**:
- Shows red circle with count when pending sources > 0
- Clicking navigates to Settings → Sources tab with pending filter
- Updates every 15 minutes (piggybacks auto-sync polling)
- Also updates immediately after accepting/rejecting sources

## Implementation Steps

### Phase 1: Database Foundation ✓

**Tasks**:
1. Create migration `20260107_create_sources_table.sql`
2. Create migration `20260107_add_source_id_to_signals.sql`
3. Test locally: `supabase db reset`
4. Verify existing signals are migrated to sources
5. Check RLS policies work correctly

**Validation**:
- [ ] Sources table created with all fields
- [ ] RLS policies prevent cross-user access
- [ ] Existing signals linked to sources via `source_id`
- [ ] All migrated sources have `status = 'active'`
- [ ] Indexes created for performance

**Estimated Time**: 1-2 hours

---

### Phase 2: Backend APIs ✓

**Tasks**:
1. Create `/api/sources/list` with pagination
2. Create `/api/sources/pending-count`
3. Create `/api/sources/accept`
4. Create `/api/sources/reject`
5. Create `/api/sources/update`
6. Create `/api/sources/delete`

**Validation**:
- [ ] List endpoint returns paginated sources
- [ ] Pending count accurate
- [ ] Accept activates source and processes pending signals
- [ ] Reject marks source and deletes pending signals
- [ ] Update changes strategy/status correctly
- [ ] Delete soft-deletes source (status = rejected)

**Estimated Time**: 3-4 hours

---

### Phase 3: Email Import Updates ✓

**Tasks**:
1. Update `/api/emails/import` - add source detection
2. Update `/api/cron/auto-sync` - add source detection
3. Add pending count to auto-sync response
4. Implement spam filtering for rejected sources

**Validation**:
- [ ] New unknown sender creates pending source
- [ ] Pending source imports signal but doesn't extract nuggets
- [ ] Active source processes normally
- [ ] Paused source imports without processing
- [ ] Rejected source emails are deleted
- [ ] Auto-sync response includes `pending_sources_count`

**Estimated Time**: 2-3 hours

---

### Phase 4: UI Components ✓

**Tasks**:
1. Create `/app/settings/page.tsx`
2. Build `SettingsLayout` with tab navigation
3. Build `SourcesTab` with pagination
4. Build `SourceCard` with brutalist design
5. Build `PendingSourcesModal`
6. Add `NotificationBadge` to CommandBar
7. Migrate existing auto-sync and preferences content

**Validation**:
- [ ] Settings page accessible at `/settings`
- [ ] Tab navigation works (SOURCES, AUTO-SYNC, PREFERENCES)
- [ ] Sources list loads with pagination (25 per page)
- [ ] Source cards display correctly with brutalist design
- [ ] Strategy dropdown changes persist
- [ ] Pause/resume/delete buttons work
- [ ] Pending modal auto-opens with pending sources
- [ ] Accept/reject actions work correctly
- [ ] Notification badge shows pending count
- [ ] Badge updates after actions
- [ ] Responsive design works on mobile

**Estimated Time**: 6-8 hours

---

### Phase 5: Integration & Testing ✓

**Tasks**:
1. End-to-end test: New email → Pending source → Accept → Process
2. End-to-end test: New email → Pending source → Reject → Spam
3. Test pagination with 50+ sources
4. Test strategy assignment and persistence
5. Test on mobile devices
6. Load testing with concurrent requests

**Validation**:
- [ ] Complete pending source workflow works
- [ ] Accepted sources process signals correctly
- [ ] Rejected sources are filtered out
- [ ] Pagination handles edge cases (0 sources, 1 page, many pages)
- [ ] Strategy changes persist and display correctly
- [ ] Mobile layout works (responsive design)
- [ ] No performance regressions

**Estimated Time**: 3-4 hours

---

## Total Estimated Time

**Total**: 15-21 hours of development time

**Breakdown**:
- Database (1-2h)
- Backend APIs (3-4h)
- Email Import (2-3h)
- UI Components (6-8h)
- Testing (3-4h)

## Testing Checklist

### Database Tests

- [ ] Sources table created successfully
- [ ] RLS policies prevent unauthorized access
- [ ] Unique constraint on (user_id, source_type, identifier) works
- [ ] Check constraints on status and source_type work
- [ ] Foreign key cascade deletes work correctly
- [ ] Indexes improve query performance

### API Tests

- [ ] List sources with pagination
- [ ] Filter sources by status
- [ ] Get pending count
- [ ] Accept source activates and processes signals
- [ ] Reject source deletes pending signals
- [ ] Update source changes strategy/status
- [ ] Delete source soft-deletes (status = rejected)
- [ ] All endpoints enforce user authentication
- [ ] RLS prevents cross-user data access

### Email Import Tests

- [ ] New sender creates pending source
- [ ] Pending source doesn't extract nuggets
- [ ] Active source extracts nuggets normally
- [ ] Paused source imports without processing
- [ ] Rejected source emails are deleted
- [ ] Duplicate detection still works
- [ ] Auto-sync returns pending count

### UI Tests

- [ ] Settings page renders correctly
- [ ] Tab navigation switches content
- [ ] Sources list displays with pagination
- [ ] Source cards show all information
- [ ] Strategy dropdown works
- [ ] Pause/resume buttons toggle status
- [ ] Delete button soft-deletes source
- [ ] Pending modal opens automatically
- [ ] Accept button activates source
- [ ] Reject button deletes source
- [ ] Notification badge shows count
- [ ] Badge updates after actions
- [ ] Responsive design on mobile

### Edge Cases

- [ ] 0 sources (empty state)
- [ ] 1 source (no pagination)
- [ ] 100+ sources (many pages)
- [ ] Accepting source with 0 pending signals
- [ ] Rejecting source with 10+ pending signals
- [ ] Rapid accept/reject clicks (race conditions)
- [ ] Network errors during API calls
- [ ] Invalid source_id in requests

## Post-Implementation

### Documentation Updates

After Phase 1 is complete:

1. Update `CLAUDE.md` with new sources system
2. Update `README.md` with new features
3. Document API endpoints in `docs/api/`
4. Add screenshots to feature docs
5. Write migration guide for existing users

### Phase 2 Planning

Once Phase 1 is deployed and stable, plan Phase 2:

1. Refactor extraction strategies to be pattern-based
2. Update nugget extraction to use `source.extraction_strategy_id`
3. Add source statistics (total signals, avg nuggets)
4. Implement advanced strategy configuration UI
5. Add AI-powered strategy auto-suggestion
6. Support for non-email source types

### Monitoring

Monitor these metrics after deployment:

- Sources created per day
- Pending sources acceptance rate
- Rejection rate
- Average time to accept/reject
- Strategy distribution (which strategies are used most)
- Source count per user
- Performance of sources list query

## Risk Mitigation

### Risk 1: Migration Fails

**Mitigation**:
- Test migration locally multiple times
- Backup production database before migration
- Have rollback script ready
- Monitor migration logs in real-time

### Risk 2: Existing Extraction Breaks

**Mitigation**:
- Keep existing extraction logic untouched in Phase 1
- Only add source detection, don't modify processing
- Test with production-like data
- Have feature flag to disable source detection if needed

### Risk 3: Performance Degradation

**Mitigation**:
- Add indexes on foreign keys
- Use pagination everywhere
- Monitor query performance
- Have database query optimization plan ready

### Risk 4: User Confusion

**Mitigation**:
- Clear UI messaging about pending sources
- Help text on strategy selector
- Empty states with guidance
- Consider adding onboarding tooltip

## Success Criteria

Phase 1 is considered successful when:

1. ✅ All existing signals migrated to sources
2. ✅ New emails create pending sources correctly
3. ✅ Accept/reject workflow works end-to-end
4. ✅ Settings page is accessible and functional
5. ✅ Notification badge updates correctly
6. ✅ No regressions in existing functionality
7. ✅ Mobile responsive design works
8. ✅ All tests passing
9. ✅ Performance is acceptable (< 2s page loads)
10. ✅ User can manage all sources via UI

## Next Steps

After this document is approved:

1. Create feature branch: `feature/sources-phase1`
2. Implement in order: Database → Backend → Email Import → UI → Testing
3. Submit PR with comprehensive testing evidence
4. Deploy to staging environment
5. User acceptance testing
6. Deploy to production
7. Monitor metrics for 1 week
8. Plan Phase 2 (strategy refactoring)

---

**Ready to begin implementation?** This design provides a complete roadmap for Phase 1 of the Sources and Strategies system.
