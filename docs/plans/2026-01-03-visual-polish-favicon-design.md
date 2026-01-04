# Visual Polish: Favicon & Source Recognition Enhancement

**Design Date**: January 3, 2026
**Status**: Approved
**Priority**: #1 Enhancement

## Overview

Add source favicons to nugget cards to improve visual recognition, editorial aesthetics, and source credibility. This enhancement transforms Signal Digest from a text-heavy digest into a polished news portal experience.

## Goals

1. **Instant Source Recognition**: Users can identify sources at a glance without reading metadata
2. **Editorial Aesthetics**: Creates a professional, news-portal look similar to Apple News or Flipboard
3. **Source Credibility**: Visual branding reinforces trust and authority of original sources

## Technical Approach

### Real-Time Fetching with Fallback Chain

- **Primary**: Google Favicon Service (high availability, CDN-backed)
- **Fallback 1**: DuckDuckGo Favicon Service (alternative CDN)
- **Fallback 2**: Source Initials (always works, no network dependency)
- **Caching**: localStorage for performance (7-day TTL, max 200 entries)

## Component Architecture

### New Component: `SourceFavicon.tsx`

**Location**: `components/v2/SourceFavicon.tsx`

**Responsibilities**:
- Extract domain from source URL
- Manage favicon fetch lifecycle with timeouts and retries
- Implement fallback chain (Google → DuckDuckGo → Initial)
- Handle localStorage caching
- Render favicon with brutal styling

**Props**:
```typescript
interface SourceFaviconProps {
  url: string | null          // Source link (nugget.link)
  source: string              // Source name (nugget.source)
  topic: string               // Topic for fallback color (nugget.topic)
}
```

**State**:
```typescript
type LoadingState = 'idle' | 'loading' | 'success' | 'error'

const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
const [loadingState, setLoadingState] = useState<LoadingState>('idle')
```

### Integration: `NuggetCard.tsx`

**Changes**:
- Import and render `SourceFavicon` component
- Position absolute top-left with `-12px` offset for dramatic overhang
- Pass `nugget.link`, `nugget.source`, `nugget.topic` as props

**Visual Position**:
```
┌─────────────────────────────────┐
│ [ICON]  NUGGET TITLE           │  ← Favicon overhangs card edge
│         Subtitle text here...   │
│                                 │
│         Description content     │
└─────────────────────────────────┘
```

## Favicon Loading Strategy

### Fetch Sequence

1. **Check localStorage cache**
   - Key: `favicon_cache[domain]`
   - If hit: Use cached URL immediately
   - If miss: Proceed to API calls

2. **Try Google Favicon API**
   - URL: `https://www.google.com/s2/favicons?domain={domain}&sz=32`
   - Timeout: 3 seconds
   - On success: Cache and display
   - On fail: Try DuckDuckGo

3. **Try DuckDuckGo Favicon API**
   - URL: `https://icons.duckduckgo.com/ip3/{domain}.ico`
   - Timeout: 2 seconds
   - On success: Cache and display
   - On fail: Use source initial

4. **Fallback to Source Initial**
   - Extract first letter of source name
   - Render as text with topic-based color
   - Cache as `"fallback:initial"`

### Error Handling

**Network Errors**:
- Implement exponential backoff (max 2 retries, 500ms delay)
- Use AbortController for proper fetch cancellation
- Log errors to console for debugging

**Timeout Handling**:
- Google API: 3s timeout (high reliability expected)
- DuckDuckGo API: 2s timeout (faster fallback)
- Timeout triggers next fallback in chain

**Invalid Responses**:
- Check response.ok before using
- Validate image loading with `new Image()`
- Fallback on 404, 403, or non-image responses

## Performance Optimizations

### Client-Side Caching

**localStorage Schema**:
```typescript
{
  "favicon_cache": {
    "techcrunch.com": "https://www.google.com/s2/favicons?domain=techcrunch.com&sz=32",
    "arstechnica.com": "https://icons.duckduckgo.com/ip3/arstechnica.com.ico",
    "unknown-blog.com": "fallback:initial"
  },
  "favicon_cache_timestamp": 1704268800000  // Refresh every 7 days
}
```

**Cache Management**:
- LRU eviction when exceeds 200 entries
- Clear cache after 7 days
- Skip cache on explicit refresh (future feature)

### Lazy Loading

**Intersection Observer**:
- Only load favicons for visible nuggets
- Load on intersection with 100px margin
- Preload top 10 nuggets immediately on page load

**Debouncing**:
- Debounce scroll events (150ms)
- Batch favicon loads for better network efficiency
- Prioritize visible nuggets over off-screen

## Visual Design

### Favicon Container

**Dimensions**: 48x48px container, 32x32px favicon
**Position**: Absolute top-left, -12px offset (overhang effect)
**Background**: White (`bg-white`)
**Border**: 3px black solid (`border-3 border-black`)
**Shadow**: None by default, brutal shadow on card hover
**Z-Index**: 15 (above card, below relevancy flag)

### Brutal Styling

```typescript
className={`
  absolute -top-3 -left-3 w-12 h-12
  bg-white border-3 border-black
  flex items-center justify-center
  transition-all duration-300
  group-hover:shadow-brutal
  z-15
`}
```

### Loading States

**Initial (Idle)**:
- Show empty white square with border
- No animation

**Loading**:
- Skeleton shimmer animation
- Light gray background pulse

**Success**:
- Fade in favicon (200ms transition)
- Apply `object-fit: contain` for proper scaling

**Error (Fallback Initial)**:
- Show first letter of source in topic color
- Font: `font-display font-black text-lg`
- Color: Topic-based background color

### Topic-Based Fallback Colors

```typescript
const getTopicColor = (topic: string): string => {
  const colors: Record<string, string> = {
    'AI & Machine Learning': 'bg-[hsl(var(--electric-blue))]',
    'Social Media & Culture': 'bg-[hsl(var(--cyber-pink))]',
    'Tech Products & Innovation': 'bg-[hsl(var(--neon-green))]',
    'Business & Finance': 'bg-[hsl(var(--warning-orange))]',
    'Startups & Funding': 'bg-[hsl(var(--warning-orange))]',
    'Climate & Energy': 'bg-[hsl(var(--neon-green))]',
    'Health & Science': 'bg-[hsl(var(--electric-blue))]',
    'Policy & Regulation': 'bg-black',
  }
  return colors[topic] || 'bg-black'
}
```

## Data Flow

```
1. DashboardV2 renders NuggetCard with nugget data
   ↓
2. NuggetCard passes link, source, topic to SourceFavicon
   ↓
3. SourceFavicon extracts domain from link
   ↓
4. Check localStorage: favicon_cache[domain]
   ↓
5a. Cache HIT → Use cached URL → Display immediately
   ↓
5b. Cache MISS → Start fetch sequence:
     - Try Google API (3s timeout)
     - On fail: Try DuckDuckGo API (2s timeout)
     - On fail: Use source initial with topic color
   ↓
6. Cache successful result in localStorage
   ↓
7. Render favicon with fade-in animation
```

## Implementation Steps

1. **Create SourceFavicon component**
   - Implement favicon fetching logic
   - Add localStorage caching
   - Create fallback rendering

2. **Integrate into NuggetCard**
   - Import SourceFavicon
   - Position at top-left with overhang
   - Pass nugget data as props

3. **Add localStorage utilities**
   - Cache management functions
   - LRU eviction logic
   - TTL expiration check

4. **Test with various sources**
   - Major newsletters (TechCrunch, Ars Technica)
   - Personal blogs (may fail, test fallback)
   - Edge cases (missing link, invalid domain)

5. **Performance optimization**
   - Implement Intersection Observer
   - Add lazy loading for off-screen nuggets
   - Measure and optimize cache hit rate

## Testing Plan

### Unit Tests
- Domain extraction from various URL formats
- Cache hit/miss logic
- Fallback chain execution
- Source initial generation

### Integration Tests
- Favicon loading in NuggetCard
- localStorage persistence across sessions
- Cache expiration after 7 days
- LRU eviction when exceeds 200 entries

### Visual Tests
- Favicon positioning and sizing
- Brutal styling matches design system
- Loading states and animations
- Topic-based fallback colors

### Performance Tests
- Time to first favicon (should be < 100ms for cached)
- Network waterfall (should batch requests)
- Cache hit rate (target > 80% after first page load)
- Memory usage with 200+ cached favicons

## Future Enhancements

1. **Opengraph Images**: Add larger preview images on hover (Priority #2)
2. **Favicon CDN**: Self-host frequently-used favicons for reliability
3. **Custom Source Icons**: Allow users to upload custom icons for personal blogs
4. **Adaptive Loading**: Adjust quality/size based on network speed
5. **Preloading**: Fetch favicons during email processing (server-side)

## Success Metrics

- **User Recognition**: Can users identify sources 2x faster? (eye tracking study)
- **Visual Appeal**: Perceived professionalism score increase (user survey)
- **Performance**: < 100ms favicon display for cached, < 1s for uncached
- **Cache Efficiency**: > 80% cache hit rate after first page load
- **Fallback Rate**: < 10% of sources require initial fallback

## Related Documents

- [Taxonomy System Architecture](../taxonomy-system.md)
- [Neo-Brutalist Design System](../design-system.md) (future)
- [Phase 1 Implementation Plan](./2025-12-30-phase1-infrastructure.md)
