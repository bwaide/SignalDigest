# External API Design

> Expose Signal Digest nuggets to external systems via a read-only REST API

**Date:** 2025-01-09
**Status:** Approved

## Overview

A read-only REST API that exposes nuggets to external systems (primarily a Claude-based Slack assistant). The API returns grouped nuggets with optional relevancy filtering, authenticated via API key.

**Key characteristics:**
- Nuggets endpoint: `GET /api/external/nuggets`
- Topics endpoint: `GET /api/external/topics`
- API key authentication
- Returns primary nuggets with related sources nested
- Optional filtering by status, topic, relevancy threshold, date range
- Read-only (no mutations)

## Use Case

The user has a personal AI assistant (Claude Agent SDK running on Hetzner, with Slack as interface) that presents a daily news digest. The assistant pulls data from Signal Digest via this API, allowing it to:

- Fetch unread nuggets since the last digest
- Optionally filter by relevancy threshold
- Present grouped stories with multiple sources
- Decide its own curation logic based on the data received

## Endpoint Specification

```
GET /api/external/nuggets
```

### Authentication

```
Authorization: Bearer <API_KEY>
```

API key format: `sd_live_<32 random chars>` (e.g., `sd_live_a1b2c3d4e5f6g7h8i9j0...`)

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | exclude archived | Filter by status: `unread`, `saved`, or `archived` |
| `topic` | string | none | Filter by topic (e.g., `AI Development`) |
| `min_relevancy` | number | none | Only return nuggets with score >= this value |
| `since` | ISO datetime | none | Only return nuggets created after this timestamp |
| `tags` | string (comma-separated) | none | Filter by tags array |
| `limit` | number | `100` | Maximum nuggets to return (max 500) |

### Example Requests

```bash
# Get saved nuggets
curl "https://signal-digest.example.com/api/external/nuggets?status=saved" \
  -H "Authorization: Bearer sd_live_abc123..."

# Get unread nuggets about AI with high relevancy
curl "https://signal-digest.example.com/api/external/nuggets?status=unread&topic=AI%20Development&min_relevancy=70" \
  -H "Authorization: Bearer sd_live_abc123..."

# Get all nuggets since yesterday
curl "https://signal-digest.example.com/api/external/nuggets?since=2025-01-08T00:00:00Z" \
  -H "Authorization: Bearer sd_live_abc123..."
```

### Response Format

```json
{
  "nuggets": [
    {
      "id": "uuid-1",
      "title": "Anthropic releases Claude 3.5 Opus",
      "description": "New flagship model with improved reasoning...",
      "relevancy_score": 95,
      "topic": "AI Development",
      "tags": ["AI Development"],
      "source": "The Batch",
      "link": "https://anthropic.com/news/...",
      "published_date": "2025-01-08T10:00:00Z",
      "created_at": "2025-01-08T14:30:00Z",
      "status": "unread",
      "user_notes": null,
      "related_sources": [
        {
          "id": "uuid-2",
          "source": "AI Weekly",
          "title": "Claude Opus 4.5 launches with new capabilities",
          "link": "https://aiweekly.com/..."
        },
        {
          "id": "uuid-3",
          "source": "Import AI",
          "title": "Anthropic's new model benchmarks",
          "link": "https://importai.com/..."
        }
      ]
    }
  ],
  "meta": {
    "total": 42,
    "returned": 42,
    "filters_applied": {
      "min_relevancy": 70,
      "unread_only": true,
      "since": "2025-01-08T00:00:00Z"
    }
  }
}
```

**Notes:**
- Only primary nuggets appear at top level
- `related_sources` contains duplicates (same story, different newsletters)
- `meta` helps the caller understand what it received

### Error Responses

```json
// 401 Unauthorized - Missing or invalid API key
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}

// 400 Bad Request - Invalid parameters
{
  "error": "bad_request",
  "message": "Invalid value for min_relevancy: must be 0-100"
}
```

## Topics Endpoint

```
GET /api/external/topics
```

Returns all topics with nugget counts, useful for building topic-based navigation or filtering.

### Example Request

```bash
curl "https://signal-digest.example.com/api/external/topics" \
  -H "Authorization: Bearer sd_live_abc123..."
```

### Response Format

```json
{
  "topics": [
    {
      "topic": "AI Development",
      "count": 25,
      "unread_count": 12,
      "saved_count": 5
    },
    {
      "topic": "Business Strategy",
      "count": 18,
      "unread_count": 8,
      "saved_count": 3
    }
  ],
  "meta": {
    "total_topics": 2
  }
}
```

## API Key Management

### Storage

New field in `user_settings` table:

```sql
ALTER TABLE user_settings
ADD COLUMN api_key_hash TEXT;
```

The API key is stored as a bcrypt hash, never in plaintext.

### Key Format

`sd_live_<32 random alphanumeric chars>`

Example: `sd_live_x7k9m2p4q8r1s5t3u6v0w2y4z8a1b3c5`

### Generation Flow

1. User navigates to Settings in Signal Digest UI
2. User clicks "Generate API Key"
3. System generates cryptographically random key
4. Key is displayed once in a copy-able format
5. Bcrypt hash of key is stored in `user_settings.api_key_hash`
6. User copies key to their external system's configuration

### Regeneration

- User can regenerate the key at any time
- Regenerating invalidates the previous key immediately
- New key is displayed once, new hash stored

### Validation Flow

1. Extract `Bearer <token>` from Authorization header
2. Look up user by attempting bcrypt compare against all user hashes (single-user system, so just one)
3. If match found, proceed with that user's context
4. If no match, return 401 Unauthorized

For a single-user system, this is simple. For future multi-tenant, would need a key prefix or lookup table.

## Implementation

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/XXXXXX_add_api_key_hash.sql` | Add `api_key_hash` column to `user_settings` |
| `app/api/external/nuggets/route.ts` | New API endpoint |
| `lib/auth/api-key.ts` | Key generation, hashing, validation utilities |
| `lib/types/database.ts` | Update `UserSettings` type |
| Settings UI component | Add "API Access" section |

### API Route Implementation

```typescript
// app/api/external/nuggets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // 1. Validate API key
  const authHeader = request.headers.get('authorization');
  const user = await validateApiKey(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const minRelevancy = searchParams.get('min_relevancy');
  const unreadOnly = searchParams.get('unread_only') === 'true';
  const since = searchParams.get('since');
  const tags = searchParams.get('tags')?.split(',');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

  // 3. Build query
  const supabase = await createClient();
  let query = supabase
    .from('nuggets')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (minRelevancy) {
    query = query.gte('relevancy_score', parseInt(minRelevancy));
  }
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (since) {
    query = query.gte('created_at', since);
  }
  if (tags?.length) {
    query = query.overlaps('tags', tags);
  }

  const { data: primaryNuggets, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch nuggets' },
      { status: 500 }
    );
  }

  // 4. Fetch related sources for each primary nugget
  const nuggets = await Promise.all(
    primaryNuggets.map(async (nugget) => {
      let relatedSources = [];

      if (nugget.duplicate_group_id) {
        const { data: related } = await supabase
          .from('nuggets')
          .select('id, source, title, link')
          .eq('duplicate_group_id', nugget.duplicate_group_id)
          .eq('is_primary', false);

        relatedSources = related || [];
      }

      return {
        id: nugget.id,
        title: nugget.title,
        description: nugget.description,
        relevancy_score: nugget.relevancy_score,
        tags: nugget.tags,
        source: nugget.source,
        link: nugget.link,
        published_date: nugget.published_date,
        created_at: nugget.created_at,
        is_read: nugget.is_read,
        user_notes: nugget.user_notes,
        related_sources: relatedSources,
      };
    })
  );

  // 5. Return response
  return NextResponse.json({
    nuggets,
    meta: {
      total: nuggets.length,
      returned: nuggets.length,
      filters_applied: {
        min_relevancy: minRelevancy ? parseInt(minRelevancy) : null,
        unread_only: unreadOnly,
        since: since || null,
        tags: tags || null,
      },
    },
  });
}
```

### API Key Utilities

```typescript
// lib/auth/api-key.ts
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

const KEY_PREFIX = 'sd_live_';

export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${KEY_PREFIX}${randomPart}`;
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

export async function validateApiKey(
  authHeader: string | null
): Promise<{ id: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const key = authHeader.slice(7);
  if (!key.startsWith(KEY_PREFIX)) {
    return null;
  }

  const supabase = await createClient();

  // For single-user system, fetch the one user with an API key
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, api_key_hash')
    .not('api_key_hash', 'is', null)
    .single();

  if (!settings?.api_key_hash) {
    return null;
  }

  const isValid = await bcrypt.compare(key, settings.api_key_hash);
  return isValid ? { id: settings.user_id } : null;
}
```

## Security Considerations

1. **Key shown once:** API key is displayed only at generation time, never retrievable again
2. **Bcrypt hashing:** Keys stored as bcrypt hashes, not plaintext
3. **HTTPS required:** All traffic over TLS (handled by Coolify/SSL)
4. **Read-only:** API cannot modify data, limiting damage from compromised key
5. **Key rotation:** User can regenerate key at any time to invalidate old one

### Future Enhancements

- **Rate limiting:** Add rate limiting (e.g., 100 requests/minute) to prevent abuse
- **Key scopes:** Allow keys with limited permissions (e.g., read-only vs read-write)
- **Multiple keys:** Support multiple API keys per user with labels
- **Audit logging:** Log API access for debugging and security review

## UI Changes

Add an "API Access" section to the Settings page:

```
┌─────────────────────────────────────────────────┐
│ API Access                                      │
├─────────────────────────────────────────────────┤
│ Use an API key to access your nuggets from      │
│ external applications.                          │
│                                                 │
│ API Key: ●●●●●●●●●●●●●●●●●●●●●●●●              │
│                                                 │
│ [Generate New Key]  [Copy Endpoint URL]         │
│                                                 │
│ Endpoint: https://signal-digest.example.com    │
│           /api/external/nuggets                 │
│                                                 │
│ Documentation: [View API Docs]                  │
└─────────────────────────────────────────────────┘
```

When "Generate New Key" is clicked:
1. Confirmation dialog warns that existing key will be invalidated
2. New key generated and displayed in a modal with copy button
3. Modal warns: "This key will only be shown once. Copy it now."
4. After modal closed, key is masked (●●●●●●●●)

## Testing

### Manual Testing

```bash
# Generate key via UI, then test:

# Basic request
curl "http://localhost:3000/api/external/nuggets" \
  -H "Authorization: Bearer sd_live_xxx..."

# With filters
curl "http://localhost:3000/api/external/nuggets?min_relevancy=80&unread_only=true" \
  -H "Authorization: Bearer sd_live_xxx..."

# Invalid key
curl "http://localhost:3000/api/external/nuggets" \
  -H "Authorization: Bearer invalid_key"
# Should return 401

# Missing auth
curl "http://localhost:3000/api/external/nuggets"
# Should return 401
```

### Integration with Assistant

Once implemented, configure the Claude Slack assistant with:

```env
SIGNAL_DIGEST_API_URL=https://signal-digest.example.com/api/external/nuggets
SIGNAL_DIGEST_API_KEY=sd_live_xxx...
```

The assistant can then fetch nuggets with a simple HTTP call and present them in Slack.
