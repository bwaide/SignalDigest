# Nugget Extraction Strategies

## Overview

The nugget extraction system uses **source-specific strategies** to intelligently extract insights from different newsletter formats. Each newsletter source can have custom rules for:

- Identifying and excluding sponsored/ad content
- Extracting main story insights
- Extracting news roundup items
- Understanding newsletter structure

## How It Works

### 1. Source Detection

When processing a signal, the system:
1. Gets the `source_identifier` (email address) from the signal
2. Matches it against registered extraction strategies using regex patterns
3. Falls back to `DEFAULT_STRATEGY` if no match found

### 2. Prompt Generation

The matched strategy is used to generate an LLM-friendly prompt that includes:
- Ad exclusion rules specific to that source
- Instructions for extracting main stories
- Instructions for extracting news roundup items (if applicable)
- Structural notes about the newsletter format
- Relevancy score guidance

### 3. Nugget Extraction

The LLM uses the strategy-specific prompt to:
- Skip sponsored content
- Extract multiple nugget types (main stories, news items)
- Assign appropriate relevancy scores
- Include source-specific context

## Current Strategies

### The Rundown AI (`@daily.therundown.ai`)

**Key Features:**
- Detects "TOGETHER WITH [BRAND]" sponsored sections
- Extracts main stories that include "Why it matters:" analysis
- Extracts each item from "Everything else in AI today" bullet lists
- Main stories: relevancy 80-100
- News items: relevancy 60-80
- Expects 8-12 nuggets per email

**Structure:**
```
1. Introduction
2. Table of contents
3. LATEST DEVELOPMENTS
   - Main story 1 (with "Why it matters:")
   - TOGETHER WITH [SPONSOR] (SKIP)
   - Main story 2 (with "Why it matters:")
   - ...
4. Everything else in AI today (extract each bullet)
5. Community/Highlights (skip)
```

### Default Strategy (Fallback)

**Key Features:**
- Generic ad detection patterns
- No news roundup extraction
- Relevancy: 70-90
- Expects 3-5 nuggets per email

Used for newsletters without specific strategy defined.

## Adding a New Strategy

### Step 1: Analyze Newsletter Structure

Before creating a strategy, analyze 3-5 sample emails to identify:

1. **Ad/Sponsored Content Patterns**
   - How are ads marked? (headers, labels, styling)
   - What promotional language is used?
   - Are there sections that should always be skipped?

2. **Main Story Format**
   - How are main articles structured?
   - Is there a "significance" section? (e.g., "Why it matters:", "Bottom line:")
   - What indicates a new story section?

3. **News Roundup Format** (if present)
   - Section header(s) that indicate news roundup
   - How are items formatted? (bullets, numbered, paragraphs)
   - How to extract company/product names?

4. **Overall Structure**
   - What's the typical email flow?
   - Which sections contain valuable insights?
   - Which sections are noise (footers, links, promotions)?

### Step 2: Create Strategy Definition

Add your strategy to `lib/nugget-extraction-strategies.ts`:

```typescript
export const YOUR_NEWSLETTER_STRATEGY: ExtractionStrategy = {
  sourceId: 'your-newsletter-id',
  sourceName: 'Your Newsletter Name',
  emailPattern: /@yourdomain\.com$/i,

  adDetection: {
    headerPatterns: [
      'SPONSORED BY',
      'PARTNER CONTENT',
      // Add patterns that indicate ads
    ],
    promotionalPhrases: [
      'limited time',
      'buy now',
      // Add promotional language
    ],
    skipSections: [
      'Unsubscribe',
      'Manage preferences',
      // Add section names to skip
    ],
  },

  mainStories: {
    sectionIndicators: [
      '### ', // Markdown header
      'STORY:',
      // Add patterns that indicate story sections
    ],
    significanceMarker: 'The Bottom Line:', // Or null if none
    relevancyRange: [75, 95],
    titleGuidance: 'Extract the headline after the topic header',
    descriptionGuidance: 'Use the opening summary paragraph',
  },

  newsRoundup: {
    sectionHeaders: [
      'Quick Hits',
      'In Brief',
    ],
    itemFormat: 'Numbered list with company name, action, and brief detail',
    relevancyRange: [60, 75],
    titleGuidance: 'Company + action (e.g., "Acme Corp launches new AI tool")',
  }, // Or null if no roundup section

  structureNotes: `
Your Newsletter Name follows this structure:
1. Opening summary
2. Main stories (3-4 per email)
   - Each has headline, summary, details, and "The Bottom Line"
3. "Quick Hits" section with 5-8 brief news items
4. Footer with unsubscribe (skip)

Extract from:
- Main stories (sections with "The Bottom Line")
- Each numbered item in "Quick Hits"

Skip:
- "SPONSORED BY" sections
- Footer/unsubscribe
`,
}
```

### Step 3: Register Strategy

Add your strategy to the `EXTRACTION_STRATEGIES` array:

```typescript
export const EXTRACTION_STRATEGIES: ExtractionStrategy[] = [
  RUNDOWN_AI_STRATEGY,
  YOUR_NEWSLETTER_STRATEGY, // Add here
  DEFAULT_STRATEGY, // Must always be last
]
```

### Step 4: Test

1. **Import a sample email** from your newsletter source
2. **Process the signal** to extract nuggets
3. **Verify output**:
   - Ads are excluded ✅
   - Main stories are extracted ✅
   - News items are extracted (if applicable) ✅
   - Relevancy scores are appropriate ✅
   - No duplicates ✅

4. **Iterate** on the strategy based on results

## Testing Extraction Strategies

### Manual Testing

```bash
# 1. Import an email from the source
# (Use the dashboard to import via IMAP)

# 2. Check the signal was created
# (View in Supabase dashboard: signals table)

# 3. Process the signal
# (Click "Process Signals" in the dashboard)

# 4. Review extracted nuggets
# (View in dashboard or Supabase: nuggets table)
```

### Automated Testing

Create test files in `docs/tests/`:

```
docs/tests/
  your-newsletter/
    sample_email.txt         # Full email source
    sample_expected_results.txt  # What should be extracted
    sample_nuggets.txt       # Actual results for comparison
```

## Best Practices

### 1. Be Specific with Patterns

❌ **Too Broad:**
```typescript
headerPatterns: ['AD', 'PROMO']
```

✅ **Specific:**
```typescript
headerPatterns: [
  'SPONSORED CONTENT',
  'PAID PROMOTION',
  'TOGETHER WITH',
]
```

### 2. Provide Context in Structure Notes

The LLM uses these notes to understand the newsletter. Be clear and comprehensive:

```typescript
structureNotes: `
Newsletter X has a unique format:
1. "The Big Story" (1 main article, always extract)
2. "Rising Stars" (3-5 startup mentions, extract each)
3. "Quick Takes" (opinions/commentary, SKIP - not factual news)
4. "Partner Spotlight" (always an ad, SKIP)

The newsletter uses ### for section headers.
Company names are in **bold**.
Significance is labeled "Why this matters:"
`

### 3. Set Appropriate Relevancy Ranges

- **Main/Featured Stories**: 80-100
- **Secondary News**: 60-80
- **Brief Mentions**: 40-60

This helps users understand importance at a glance.

### 4. Test with Multiple Samples

Don't base your strategy on a single email. Test with:
- At least 3 different email samples
- Different content types (if newsletter varies)
- Edge cases (all ads, very long, very short)

## Troubleshooting

### Issue: Ads still being extracted

**Solution:** Add more patterns to `adDetection.headerPatterns`. Check if ads have consistent markers.

### Issue: Missing nuggets from news roundup

**Solution:**
1. Verify `sectionHeaders` match exactly
2. Check if `itemFormat` description is clear
3. Ensure `titleGuidance` explains how to parse items

### Issue: Wrong relevancy scores

**Solution:** Adjust `relevancyRange` values and add guidance in `structureNotes` about what makes content high/low priority.

### Issue: Duplicate nuggets

**Solution:** Review `structureNotes` to clarify which sections contain unique vs. repeated content.

## Future Enhancements

Potential improvements to the strategy system:

1. **Link extraction patterns** - Regex for finding URLs in different formats
2. **Tag generation rules** - Automatic tag extraction from content patterns
3. **Multi-language support** - Strategy variants for different languages
4. **Dynamic strategy updates** - Learn and refine strategies based on user feedback
5. **Strategy versioning** - Track changes to strategies over time

## Contributing

When adding a new strategy:

1. Create strategy definition in `lib/nugget-extraction-strategies.ts`
2. Add test samples to `docs/tests/[source-name]/`
3. Document the source's structure in `structureNotes`
4. Test with multiple emails before committing
5. Update this README with the new source
