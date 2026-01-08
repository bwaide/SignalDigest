# UI/UX Improvements

## Overview

This document tracks planned UI/UX improvements to enhance the Signal Digest experience with better design consistency, usability, and performance.

## 1. Settings Page Redesign (Full Page)

**Status**: Planned
**Priority**: High
**Related**: [Sources and Strategies System](./sources-and-strategies.md)

### Problem

The current Settings overlay is becoming visually complex and data-rich. Content no longer fits comfortably in the small modal window, making it difficult to:
- View source statistics
- Configure extraction strategies
- Manage auto-sync settings
- Review signal history with timestamps

### Solution

Create a full-page Settings interface similar to the tab navigation used for nuggets (INBOX/SAVED/ARCHIVE).

### Design

**Route**: `/settings`

**Layout Structure**:
```
┌──────────────────────────────────────────────┐
│ [LOGO] Settings          [Back to Inbox] ▶  │ ← Header (same as main app)
├──────────────────────────────────────────────┤
│ SOURCES | AUTO-SYNC | PREFERENCES            │ ← Tab Navigation (brutalist style)
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│  Settings Content Area                       │
│  (Tab-specific content)                      │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

**Tab Navigation**:
- Same design as nugget tabs (INBOX/SAVED/ARCHIVE)
- Thick black borders
- Active tab: electric blue background
- Inactive tabs: white background with hover state

**Tabs**:

1. **SOURCES** (new)
   - Replaces current "Signals" section
   - Shows all active/paused/pending sources
   - Pagination: 25 sources per page
   - See [Sources Tab Specification](#sources-tab-specification) below

2. **AUTO-SYNC** (existing)
   - Migrate current auto-sync configuration
   - Email connection settings
   - Sync frequency settings

3. **PREFERENCES** (existing)
   - User interests description
   - Relevancy threshold
   - Approved topics/taxonomy
   - Display preferences

### Sources Tab Specification

**Features**:
- **Source Cards**: Display each source with statistics
- **Pagination**: 25 sources per page (bottom pagination controls)
- **Filters**: Active, Paused, Pending (optional filter buttons)
- **Search**: Quick filter by source name
- **Actions**: Pause, Resume, Delete per source
- **Strategy Selector**: Dropdown to change extraction strategy

**Source Card Design** (brutalist):
```
┌─────────────────────────────────────────────────────┐
│ THE RUNDOWN AI                         [PAUSE] [×]  │ ← Name + actions
├─────────────────────────────────────────────────────┤
│ daily@therundown.ai | The Rundown                   │ ← Identifier
│                                                     │
│ Strategy: Ad-Heavy Link Listing ▼                   │ ← Strategy dropdown
├─────────────────────────────────────────────────────┤
│ 142 signals | 8.3 nuggets/signal | Daily            │ ← Statistics
│ Last seen: Jan 6, 2026 3:45 PM                      │ ← Date AND time
└─────────────────────────────────────────────────────┘
```

**Card Elements**:
- **Header**: Source display name + action buttons (Pause/Resume, Delete)
- **Identifier Row**: Email address or source identifier
- **Strategy Row**: Dropdown selector (changes take effect on next import)
- **Stats Row**:
  - Total signals received
  - Average nuggets per signal
  - Frequency estimate (Daily, Weekly, etc.)
- **Timestamp Row**: Last signal received with date AND time (not just date)

**Pagination Controls** (bottom of page):
```
┌─────────────────────────────────────┐
│  [◄ PREV]  1 2 3 ... 8  [NEXT ►]   │
│  Showing 1-25 of 187 sources        │
└─────────────────────────────────────┘
```

### Implementation Notes

**Navigation**:
- Settings icon in header links to `/settings` instead of opening overlay
- "Back to Inbox" button returns to `/` (main dashboard)
- Tab state persists in URL query param: `/settings?tab=sources`

**Data Loading**:
- Server-side pagination for sources list
- React Query for data fetching and caching
- Optimistic updates for strategy changes

**Responsive Design**:
- Full page on desktop
- Same responsive patterns as dashboard
- Tabs scroll horizontally on mobile if needed

---

## 2. Brutalist-Minimal Design System

**Status**: Planned
**Priority**: High

### Problem

Settings UI currently doesn't match the brutalist-minimal design established in the rest of the app (CommandBar, NuggetCard, tabs).

### Solution

Apply consistent brutalist design tokens and patterns to ALL settings components.

### Design Tokens

**Colors**:
- Primary: `hsl(var(--electric-blue))` (RGB: 0, 255, 255)
- Black: `#000000`
- White: `#FFFFFF`
- Gray borders: `black/10`

**Typography**:
- Headers: `font-display font-black` (Bebas Neue or similar)
- Body: `font-sans` (system font stack)
- Sizes: `text-sm`, `text-base`, `text-lg`

**Borders**:
- All elements: `border-2 border-black`
- Hover states: `hover:bg-black hover:text-white`
- Active states: `bg-[hsl(var(--electric-blue))] text-white`

**Spacing**:
- Consistent padding: `p-4`, `p-6`
- Gap between elements: `gap-2`, `gap-4`

**Buttons**:
```typescript
// Primary action
className="px-6 py-3 bg-[hsl(var(--electric-blue))] text-white border-2 border-black font-display font-black hover:bg-black"

// Secondary action
className="px-6 py-3 bg-white text-black border-2 border-black font-display font-black hover:bg-black hover:text-white"

// Danger action
className="px-6 py-3 bg-red-500 text-white border-2 border-black font-display font-black hover:bg-black"

// Icon button (square)
className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black hover:bg-black hover:text-white"
```

**Form Inputs**:
```typescript
// Text input
className="w-full px-4 py-2 border-2 border-black focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"

// Dropdown/Select
className="px-4 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"

// Checkbox
className="w-5 h-5 border-2 border-black checked:bg-[hsl(var(--electric-blue))]"
```

**Cards**:
```typescript
className="border-2 border-black bg-white"
```

### Components to Update

**Existing Settings Components**:
- `ConnectionStatus.tsx` - Already updated
- Email configuration form - Needs brutalist styling
- Auto-sync settings form - Needs brutalist styling
- User preferences form - Needs brutalist styling

**New Settings Components**:
- Source cards - Build with brutalist design from start
- Strategy selector dropdown - Brutalist styling
- Pagination controls - Brutalist styling
- Modal dialogs - Brutalist styling

### Reference Components

Use these as design reference:
- `components/v2/CommandBar.tsx` - Header, buttons, responsive design
- `components/v2/NuggetCard.tsx` - Cards, borders, hover states
- `components/v2/DashboardV2.tsx` - Tab navigation, layout

---

## 3. Signals/Sources Tab Enhancements

**Status**: Planned
**Priority**: Medium

### 3.1 Pagination

**Current**: All signals/sources loaded at once
**Problem**: Performance degrades with 100+ sources
**Solution**: Server-side pagination

**Specification**:
- **Page Size**: 25 sources per page
- **Navigation**: Previous/Next buttons + page numbers
- **Info Text**: "Showing 1-25 of 187 sources"
- **Persistence**: Page number in URL query param
- **Scroll**: Reset to top on page change

**Implementation**:
```typescript
// API endpoint: /api/sources/list
GET /api/sources/list?page=1&limit=25&status=active

// Response:
{
  sources: [...],
  pagination: {
    page: 1,
    limit: 25,
    total: 187,
    totalPages: 8,
    hasNext: true,
    hasPrev: false
  }
}
```

### 3.2 Enhanced Timestamps

**Current**: Date only (e.g., "Jan 6, 2026")
**Problem**: Not enough precision for frequent sources
**Solution**: Show date AND time

**Format**: `Jan 6, 2026 3:45 PM`

**Implementation**:
```typescript
const formatTimestamp = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}
```

**Display Locations**:
- Source card: "Last seen: Jan 6, 2026 3:45 PM"
- Signal details: "Received: Jan 6, 2026 3:45 PM"
- Pending source modal: "First seen: Jan 6, 2026 3:45 PM"

---

## 4. Extraction Strategy Configuration UI

**Status**: Planned
**Priority**: High
**Related**: [Sources and Strategies System](./sources-and-strategies.md)

### Problem

Extraction strategies are currently hardcoded in `lib/nugget-extraction-strategies.ts`. Adding new newsletter types or customizing extraction requires code changes.

### Solution

Make extraction strategies configurable per source through the UI.

### Design Approach

**Two Levels of Configuration**:

1. **Simple Mode** (Default): Dropdown selector
   - Choose from pre-built strategy types
   - "Ad-Heavy Link Listing"
   - "Long-form Deep Dive"
   - "News Digest"
   - "Generic/Default"

2. **Advanced Mode** (Optional): Per-source customization
   - Override specific settings
   - Ad detection patterns
   - Relevancy score ranges
   - Section markers
   - Show as collapsible "Advanced Settings" section

### Simple Mode UI

**Location**: Source card in Settings → Sources tab

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ THE RUNDOWN AI                         [PAUSE] [×]  │
├─────────────────────────────────────────────────────┤
│ daily@therundown.ai | The Rundown                   │
│                                                     │
│ Strategy: [Ad-Heavy Link Listing ▼    ] [Advanced] │ ← Dropdown + button
├─────────────────────────────────────────────────────┤
│ 142 signals | 8.3 nuggets/signal | Daily            │
│ Last seen: Jan 6, 2026 3:45 PM                      │
└─────────────────────────────────────────────────────┘
```

**Dropdown Options**:
```
┌────────────────────────────────────┐
│ Ad-Heavy Link Listing       ✓      │ ← Current selection
│ Long-form Deep Dive                │
│ News Digest                        │
│ Generic/Default                    │
└────────────────────────────────────┘
```

**Behavior**:
- Change dropdown → Confirmation modal → Update source
- Changes apply to future signals only (don't re-process existing)
- Show tooltip on hover explaining each strategy type

### Advanced Mode UI

**Trigger**: Click "Advanced" button on source card

**Design**: Modal with tabbed configuration

```
┌─────────────────────────────────────────────────────────────┐
│ CONFIGURE STRATEGY: THE RUNDOWN AI                      [×] │
├─────────────────────────────────────────────────────────────┤
│ AD DETECTION | MAIN STORIES | NEWS ROUNDUP | STRUCTURE      │ ← Tabs
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Header Patterns (one per line)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SPONSORED                                           │   │
│  │ TOGETHER WITH                                       │   │
│  │ PARTNER CONTENT                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Promotional Phrases                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ limited time, buy now, sign up now                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Skip Sections                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ unsubscribe, manage preferences, footer             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                          [RESET TO DEFAULT] [SAVE CHANGES]  │
└─────────────────────────────────────────────────────────────┘
```

**Tabs**:
1. **AD DETECTION**: Header patterns, promotional phrases, skip sections
2. **MAIN STORIES**: Section indicators, significance marker, relevancy range, title/description guidance
3. **NEWS ROUNDUP**: Section headers, item format, relevancy range, title guidance
4. **STRUCTURE**: Free-text notes about newsletter structure

**Actions**:
- **Reset to Default**: Revert to strategy type defaults
- **Save Changes**: Store in `sources.extraction_config` JSONB
- **Cancel**: Close without saving

**Validation**:
- Test configuration with latest signal before saving
- Show preview of extracted nuggets
- Warn if config would extract 0 nuggets

### Strategy Auto-Suggestion

**When**: New source is detected (pending state)

**How**:
1. Analyze first email content
2. Call AI Gateway with prompt: "Classify this newsletter format"
3. Get suggested strategy type + confidence score
4. Pre-select in dropdown when user reviews pending source

**Prompt Example**:
```
Analyze this newsletter and suggest the best extraction strategy type.

Newsletter Content:
[First 2000 chars of email]

Strategy Types:
1. Ad-Heavy Link Listing: Curated links with ads, extract per link
2. Long-form Deep Dive: In-depth analysis, extract key arguments
3. News Digest: Structured roundup, extract per item
4. Generic: Unknown format, conservative extraction

Return JSON:
{
  "suggested_strategy": "ad-heavy-link-listing",
  "confidence": 0.87,
  "reasoning": "Newsletter has clear 'TOGETHER WITH' sponsored sections, bullet-point news items, and link-heavy format typical of curation newsletters."
}
```

**UI Presentation**:
```
┌───────────────────────────────────────────┐
│ MORNING BREW                              │
│ newsletter@morningbrew.com                │
│ First seen: Jan 6, 2026 09:30 AM          │
│                                           │
│ Strategy: News Digest ▼      (87% match) │ ← Auto-suggested + confidence
│                                           │
│         [ACCEPT]  [REJECT]                │
└───────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Settings Page Foundation
- [ ] Create `/settings` route
- [ ] Build tab navigation component
- [ ] Migrate auto-sync settings to new page
- [ ] Migrate user preferences to new page
- [ ] Update header Settings button to link to new page
- [ ] Remove old settings overlay

### Phase 2: Sources Tab
- [ ] Build source card component (brutalist design)
- [ ] Implement sources list with pagination (25 per page)
- [ ] Add timestamp formatting (date + time)
- [ ] Implement strategy dropdown selector
- [ ] Add pause/resume/delete actions
- [ ] Connect to sources API endpoints

### Phase 3: Brutalist Design System
- [ ] Document design tokens
- [ ] Create shared component library
- [ ] Apply brutalist styling to all form inputs
- [ ] Apply brutalist styling to all buttons
- [ ] Apply brutalist styling to all cards
- [ ] Apply brutalist styling to modals
- [ ] Test responsive behavior on mobile

### Phase 4: Advanced Strategy Configuration
- [ ] Build advanced settings modal
- [ ] Implement tabbed configuration UI
- [ ] Add form validation
- [ ] Add preview/test functionality
- [ ] Store config in `sources.extraction_config`
- [ ] Update extraction logic to use per-source config

### Phase 5: Strategy Auto-Suggestion
- [ ] Build AI classification prompt
- [ ] Integrate with pending sources workflow
- [ ] Display confidence score in UI
- [ ] Allow user override

---

## Design Resources

**Figma/Wireframes**: (to be added)

**Color Palette**:
- Electric Blue: `hsl(180, 100%, 50%)` / `#00FFFF`
- Black: `#000000`
- White: `#FFFFFF`

**Typography**:
- Display: Bebas Neue (or similar heavy sans-serif)
- Body: System font stack

**Inspiration**:
- Brutalist web design movement
- Swiss design (International Typographic Style)
- Bauhaus aesthetics

**Reference Sites**:
- [brutalistwebsites.com](https://brutalistwebsites.com)
- Existing Signal Digest components (CommandBar, NuggetCard)

---

## Success Metrics

**Usability**:
- Time to configure source: < 1 minute
- Settings page load time: < 2 seconds
- Mobile usability score: > 90/100

**Design Consistency**:
- All components use design tokens: 100%
- Accessible color contrast: WCAG AA compliant
- Responsive breakpoints working: Mobile + desktop

**Performance**:
- Sources list pagination: < 500ms per page
- Strategy changes apply: < 1 second
- No layout shifts (CLS < 0.1)

---

## Future Enhancements

1. **Dark Mode**: Invert color scheme while maintaining brutalist aesthetic
2. **Keyboard Shortcuts**: Navigate settings with keyboard
3. **Bulk Actions**: Edit multiple sources at once
4. **Import/Export**: Share strategy configurations
5. **A/B Testing**: Test different strategies on same source
6. **Analytics Dashboard**: Visualize source statistics over time
