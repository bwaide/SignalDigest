# Quick Start: Adding a Newsletter Extraction Strategy

## 5-Minute Setup

### Step 1: Identify the Source

Get the email address pattern:
```
From: Newsletter Name <news@newsletter.com>
Pattern: /@newsletter\.com$/i
```

### Step 2: Copy Template

```typescript
export const YOUR_STRATEGY: ExtractionStrategy = {
  sourceId: 'newsletter-name',
  sourceName: 'Newsletter Name',
  emailPattern: /@newsletter\.com$/i,

  adDetection: {
    headerPatterns: ['SPONSORED', 'AD:'],
    promotionalPhrases: ['buy now', 'limited time'],
    skipSections: ['Unsubscribe', 'Footer'],
  },

  mainStories: {
    sectionIndicators: ['###', 'STORY:'],
    significanceMarker: 'Why it matters:',
    relevancyRange: [80, 100],
    titleGuidance: 'Extract headline after section marker',
    descriptionGuidance: 'Use opening paragraph',
  },

  newsRoundup: {
    sectionHeaders: ['Quick Hits', 'News Roundup'],
    itemFormat: 'Bullet points with company name + action',
    relevancyRange: [60, 80],
    titleGuidance: 'Company + action (e.g., "Acme launches tool")',
  },

  structureNotes: `
1. Main story (extract)
2. Sponsored section (skip)
3. News roundup bullets (extract each)
  `,
}
```

### Step 3: Register It

In `lib/nugget-extraction-strategies.ts`:

```typescript
export const EXTRACTION_STRATEGIES: ExtractionStrategy[] = [
  RUNDOWN_AI_STRATEGY,
  YOUR_STRATEGY,        // Add here
  DEFAULT_STRATEGY,     // Must be last
]
```

### Step 4: Test It

1. Import an email from that source
2. Click "Process Signals"
3. Check nuggets extracted
4. Adjust strategy if needed

## Common Patterns

### Tech Newsletter (Like The Rundown)
```typescript
adDetection: {
  headerPatterns: ['TOGETHER WITH', 'SPONSORED'],
  promotionalPhrases: ['get started', 'limited time'],
  skipSections: ['Community', 'Highlights'],
}

mainStories: {
  significanceMarker: 'Why it matters:',
  relevancyRange: [80, 100],
}

newsRoundup: {
  sectionHeaders: ['Everything else in'],
  relevancyRange: [60, 80],
}
```

### Industry Newsletter (Business/Finance)
```typescript
adDetection: {
  headerPatterns: ['PAID PROMOTION', 'PARTNER'],
  promotionalPhrases: ['subscribe now', 'join today'],
  skipSections: ['Advertise with us'],
}

mainStories: {
  significanceMarker: 'The Bottom Line:',
  relevancyRange: [75, 95],
}

newsRoundup: null  // No roundup section
```

### Research/Academic Newsletter
```typescript
adDetection: {
  headerPatterns: ['ADVERTISEMENT'],
  promotionalPhrases: [],
  skipSections: ['Submission guidelines'],
}

mainStories: {
  significanceMarker: 'Implications:',
  relevancyRange: [85, 100],
}

newsRoundup: {
  sectionHeaders: ['Recent Publications'],
  relevancyRange: [70, 85],
}
```

## Checklist

Before deploying your strategy:

- [ ] Tested with 3+ sample emails
- [ ] Ads are excluded
- [ ] Main stories extracted
- [ ] News items extracted (if applicable)
- [ ] No duplicates
- [ ] Relevancy scores appropriate
- [ ] Structure notes are clear

## Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| Ads still extracted | Add pattern to `headerPatterns` |
| Missing news items | Check `sectionHeaders` match exactly |
| Wrong relevancy | Adjust `relevancyRange` |
| Duplicates | Clarify `structureNotes` |
| Missing main stories | Verify `significanceMarker` |

## Need Help?

See full documentation: `docs/nugget-extraction-strategies.md`
