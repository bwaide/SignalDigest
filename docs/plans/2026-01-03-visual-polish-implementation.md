# Visual Polish Implementation Plan

**Based on**: [Visual Polish Favicon Design](./2026-01-03-visual-polish-favicon-design.md)
**Created**: January 3, 2026
**Estimated Complexity**: Medium

## Implementation Steps

### Step 1: Create localStorage Cache Utilities

**File**: `lib/favicon-cache.ts`

**Purpose**: Centralized caching logic for favicons

**Functions**:
```typescript
// Get favicon from cache or return null
getFaviconFromCache(domain: string): string | null

// Store favicon URL in cache
setFaviconCache(domain: string, url: string): void

// Check if cache needs refresh (7-day TTL)
isCacheStale(): boolean

// Clear entire cache
clearFaviconCache(): void

// Evict oldest entry (LRU)
evictOldestCacheEntry(): void

// Get cache size
getCacheSize(): number
```

**Implementation Notes**:
- Use try-catch for localStorage access (may be disabled)
- Implement LRU tracking with access timestamps
- Auto-evict when cache exceeds 200 entries
- Handle quota exceeded errors gracefully

**Testing**:
- Test localStorage availability
- Test cache hit/miss scenarios
- Test LRU eviction logic
- Test TTL expiration after 7 days (mock Date.now())

---

### Step 2: Create Domain Extraction Utility

**File**: `lib/favicon-cache.ts` (add to existing file)

**Function**:
```typescript
// Extract domain from URL, handle edge cases
extractDomain(url: string | null): string | null

// Examples:
// "https://techcrunch.com/2024/..." → "techcrunch.com"
// "http://www.example.com" → "example.com"
// "invalid-url" → null
// null → null
```

**Edge Cases**:
- Null or empty URL
- URLs without protocol
- Subdomains (keep www, remove others?)
- International domains (punycode)
- Invalid URLs (malformed)

**Testing**:
- Test various URL formats
- Test null/undefined input
- Test malformed URLs
- Test international domains

---

### Step 3: Create SourceFavicon Component

**File**: `components/v2/SourceFavicon.tsx`

**Component Structure**:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { getFaviconFromCache, setFaviconCache, extractDomain } from '@/lib/favicon-cache'

interface SourceFaviconProps {
  url: string | null
  source: string
  topic: string
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export function SourceFavicon({ url, source, topic }: SourceFaviconProps) {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')

  useEffect(() => {
    // 1. Extract domain
    // 2. Check cache
    // 3. If miss, fetch with fallback chain
    // 4. Update state and cache
  }, [url, source])

  // Render based on loadingState
  // - idle/loading: skeleton
  // - success: <img> with faviconUrl
  // - error: source initial with topic color
}
```

**Fetch Logic**:
```typescript
async function fetchFavicon(domain: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    // Try Google API
    const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    const response = await fetch(googleUrl, {
      signal: controller.signal,
      mode: 'no-cors'  // May need CORS proxy
    })

    if (response.ok) {
      clearTimeout(timeout)
      return googleUrl
    }

    // Try DuckDuckGo API (with new timeout)
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
    // Similar fetch logic with 2s timeout

    // Both failed, return null (will use fallback)
    return null
  } catch (error) {
    console.error('Favicon fetch error:', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}
```

**Styling**:
- Use same TOPIC_COLORS from FilterRail
- Brutal border and shadow on hover
- Smooth fade-in transition for loaded favicons
- Skeleton shimmer animation for loading state

**Testing**:
- Test with valid source URLs
- Test with null/invalid URLs
- Test cache hit scenario
- Test fallback to initial
- Test loading states render correctly

---

### Step 4: Integrate SourceFavicon into NuggetCard

**File**: `components/v2/NuggetCard.tsx`

**Changes**:
1. Import SourceFavicon component
2. Add favicon rendering before title
3. Adjust layout to accommodate favicon overhang

**Code Changes**:
```typescript
import { SourceFavicon } from './SourceFavicon'

// Inside the article element, before title:
<article className={...}>
  {/* Favicon - Top left overhang */}
  <SourceFavicon
    url={nugget.link}
    source={nugget.source}
    topic={nugget.topic}
  />

  {/* Relevancy Flag - Top right */}
  <div className={`absolute -top-3 -right-3 ...`}>
    {relevancyLabel} {nugget.relevancy_score}
  </div>

  {/* Rest of card content */}
  <div className="p-6">
    <h2 className="font-display font-black ...">
      {nugget.title}
    </h2>
    ...
  </div>
</article>
```

**Visual Verification**:
- Favicon doesn't overlap with title text
- Overhang effect looks intentional (not clipped)
- Positioning works on mobile (responsive check)
- Z-index layering is correct (favicon < relevancy flag)

**Testing**:
- Render with various nugget data
- Test with missing link field
- Test responsive layout
- Test hover effects don't conflict

---

### Step 5: Add Intersection Observer for Lazy Loading

**File**: `components/v2/SourceFavicon.tsx`

**Enhancement**: Only fetch favicons when nugget enters viewport

**Implementation**:
```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && loadingState === 'idle') {
          // Start favicon fetch
          loadFavicon()
        }
      })
    },
    {
      rootMargin: '100px', // Load 100px before entering viewport
      threshold: 0.1
    }
  )

  if (ref.current) {
    observer.observe(ref.current)
  }

  return () => observer.disconnect()
}, [])
```

**Benefits**:
- Reduces initial page load (don't fetch off-screen favicons)
- Improves performance on large nugget lists
- Better network utilization

**Testing**:
- Verify favicons load as user scrolls
- Test with long list of nuggets
- Measure network request timing

---

### Step 6: Preload Top Nuggets

**File**: `components/v2/DashboardV2.tsx`

**Enhancement**: Preload favicons for top 10 visible nuggets immediately

**Implementation**:
```typescript
useEffect(() => {
  // Preload favicons for first 10 nuggets
  const topNuggets = sortedNuggets.slice(0, 10)
  topNuggets.forEach((nugget) => {
    if (nugget.link) {
      const domain = extractDomain(nugget.link)
      if (domain && !getFaviconFromCache(domain)) {
        // Prefetch favicon (fire and forget)
        fetchFavicon(domain).then((url) => {
          if (url) setFaviconCache(domain, url)
        })
      }
    }
  })
}, [sortedNuggets])
```

**Benefits**:
- Instant favicon display for above-fold content
- Better perceived performance
- Warms cache for common sources

**Testing**:
- Verify top 10 favicons load immediately
- Ensure doesn't block page render
- Check cache warming works

---

## Build & Test Sequence

### Development Testing
```bash
# Start dev server
npm run dev

# Open dashboard with nuggets
# Verify favicons load and display correctly
# Test with various newsletters
# Test fallback behavior
# Test cache persistence (refresh page)
```

### Production Testing
```bash
# Build production bundle
npm run build

# Check for build errors
# Verify no console warnings

# Start production server
npm start

# Test production behavior
# Verify performance (no slowdowns)
```

### Lint & Type Check
```bash
# Run linter
npm run lint

# Verify TypeScript types
npm run type-check  # If available
```

---

## Acceptance Criteria

### Functionality
- [x] Favicons display for nuggets with valid links
- [x] Fallback to source initial works when favicon unavailable
- [x] localStorage caching works across page refreshes
- [x] LRU eviction prevents cache from growing unbounded
- [x] Loading states render correctly (skeleton → favicon)

### Performance
- [x] Cached favicons display in < 100ms
- [x] Uncached favicons display in < 1s
- [x] Page load time not significantly impacted
- [x] No layout shift when favicons load
- [x] Intersection Observer reduces initial network requests

### Visual Design
- [x] Favicon positioning matches design (top-left overhang)
- [x] Brutal border and shadow on hover
- [x] Topic-based colors for fallback initials
- [x] Responsive on mobile devices
- [x] Z-index layering correct (favicon < relevancy)

### Error Handling
- [x] Gracefully handles missing URLs
- [x] Handles localStorage quota exceeded
- [x] Handles network timeouts
- [x] Handles CORS issues (if any)
- [x] Console errors logged for debugging

---

## Rollout Plan

### Phase 1: Internal Testing
1. Implement on local development
2. Test with real newsletter data
3. Verify cache behavior over time
4. Monitor console for errors

### Phase 2: Deploy to Production
1. Run full build and lint checks
2. Commit changes with descriptive message
3. Deploy via Coolify
4. Monitor production logs for errors

### Phase 3: Monitor & Optimize
1. Track cache hit rate (add analytics?)
2. Monitor favicon load times
3. Identify common failure domains
4. Optimize fallback colors based on usage

---

## Future Enhancements (Post-MVP)

1. **Opengraph Image Preview** (Priority #2 Enhancement)
   - Show larger preview image on hover
   - Fetch from `<meta property="og:image">` tag
   - Cache with same localStorage strategy

2. **Favicon CDN**
   - Self-host frequently-used favicons
   - Reduce dependency on external APIs
   - Better reliability and performance

3. **Custom Source Icons**
   - Allow users to upload custom icons
   - Store in Supabase Storage
   - Override default favicon for specific sources

4. **Server-Side Prefetching**
   - Fetch favicons during email processing
   - Store in database alongside nugget
   - Eliminate client-side fetch latency

5. **Adaptive Quality**
   - Detect network speed
   - Serve lower-quality favicons on slow connections
   - Progressive enhancement approach

---

## Related Files

**New Files**:
- `lib/favicon-cache.ts` - Caching utilities
- `components/v2/SourceFavicon.tsx` - Favicon component

**Modified Files**:
- `components/v2/NuggetCard.tsx` - Integration
- `components/v2/DashboardV2.tsx` - Preloading (optional)

**Documentation**:
- `docs/plans/2026-01-03-visual-polish-favicon-design.md` - Design spec
- `docs/plans/2026-01-03-visual-polish-implementation.md` - This file
