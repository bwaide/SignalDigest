/**
 * Nugget Extraction Strategies
 *
 * This file defines how to extract nuggets from different newsletter sources.
 * Each source can have custom rules for identifying valuable content vs ads/noise.
 */

export interface ExtractionStrategy {
  /** Unique identifier for this source */
  sourceId: string

  /** Human-readable name */
  sourceName: string

  /** Pattern to match email addresses from this source */
  emailPattern: RegExp

  /** Instructions for identifying sponsored/ad content to exclude */
  adDetection: {
    /** Patterns that indicate sponsored content */
    headerPatterns: string[]
    /** Phrases that indicate promotional content */
    promotionalPhrases: string[]
    /** Sections that should be skipped entirely */
    skipSections: string[]
  }

  /** Instructions for extracting main story nuggets */
  mainStories: {
    /** Patterns that indicate a main story section */
    sectionIndicators: string[]
    /** Pattern that indicates the "why this matters" conclusion */
    significanceMarker: string | null
    /** Expected relevancy score range for main stories */
    relevancyRange: [number, number]
    /** How to extract the title */
    titleGuidance: string
    /** How to extract the description */
    descriptionGuidance: string
  }

  /** Instructions for extracting news roundup nuggets */
  newsRoundup: {
    /** Patterns that indicate a news roundup section */
    sectionHeaders: string[]
    /** How items are formatted (e.g., bullet points, numbered list) */
    itemFormat: string
    /** Expected relevancy score range for roundup items */
    relevancyRange: [number, number]
    /** How to extract title from each item */
    titleGuidance: string
  } | null

  /** Additional context about this newsletter's structure */
  structureNotes: string
}

/**
 * Default/fallback extraction strategy for unknown sources
 */
export const DEFAULT_STRATEGY: ExtractionStrategy = {
  sourceId: 'default',
  sourceName: 'Generic Newsletter',
  emailPattern: /.*/,
  adDetection: {
    headerPatterns: [
      'SPONSORED',
      'ADVERTISEMENT',
      'PARTNER CONTENT',
      'TOGETHER WITH',
    ],
    promotionalPhrases: [
      'limited time offer',
      'buy now',
      'shop now',
      'get started today',
      'sign up now',
    ],
    skipSections: [
      'unsubscribe',
      'manage preferences',
      'footer',
    ],
  },
  mainStories: {
    sectionIndicators: [],
    significanceMarker: null,
    relevancyRange: [70, 90],
    titleGuidance: 'Extract the headline or main topic of the story',
    descriptionGuidance: 'Summarize the key point in 1-2 sentences',
  },
  newsRoundup: null,
  structureNotes: 'Generic newsletter without specific structure patterns.',
}

/**
 * The Rundown AI newsletter extraction strategy
 */
export const RUNDOWN_AI_STRATEGY: ExtractionStrategy = {
  sourceId: 'rundown-ai',
  sourceName: 'The Rundown AI',
  emailPattern: /@daily\.therundown\.ai$/i,
  adDetection: {
    headerPatterns: [
      'TOGETHER WITH',
    ],
    promotionalPhrases: [
      'start fine-tuning now',
      'get started',
      'limited time',
      'free until',
    ],
    skipSections: [
      'Community AI workflows',
      'Highlights: News, Guides',
      'See you soon',
    ],
  },
  mainStories: {
    sectionIndicators: [
      'LATEST DEVELOPMENTS',
      '#### ', // Markdown H4 indicates story headlines
    ],
    significanceMarker: 'Why it matters:',
    relevancyRange: [80, 100],
    titleGuidance: 'Use the headline that appears after the topic header (e.g., "IG head says platform must evolve fast due to AI")',
    descriptionGuidance: 'Use the text after "The Rundown:" as the description, or the opening paragraph if no "The Rundown:" label exists',
  },
  newsRoundup: {
    sectionHeaders: [
      'Everything else in AI today',
      'Everything else in',
    ],
    itemFormat: 'Bullet points where company/product names are bolded, followed by 1-2 sentence summary',
    relevancyRange: [60, 80],
    titleGuidance: 'Extract: [Company/Product Name] + [action/announcement]. Example: "IQuest Labs released IQuest-Coder-V1"',
  },
  structureNotes: `
The Rundown AI follows a consistent structure:
1. Introduction/teaser
2. Table of contents ("In today's AI rundown")
3. LATEST DEVELOPMENTS section with 3-5 main stories
   - Each story has a topic header (e.g., "INSTAGRAM", "DEEPSEEK")
   - Story includes: headline, "The Rundown:" summary, "The details:" bullets, "Why it matters:" analysis
   - Sponsored content is clearly marked with "TOGETHER WITH [BRAND]" and lacks "Why it matters:"
4. "Everything else in [topic] today" section with 5-10 brief news items as bullet points
5. Community workflows and highlights (skip these)

Extract nuggets from:
- Main stories (sections with "Why it matters:" that are NOT marked "TOGETHER WITH")
- Each bullet point in "Everything else" sections

Do NOT extract from:
- Sections with "TOGETHER WITH" in header
- Table of contents lists
- Community workflows
- Newsletter highlights/links to other content
`,
}

/**
 * Registry of all extraction strategies
 */
export const EXTRACTION_STRATEGIES: ExtractionStrategy[] = [
  RUNDOWN_AI_STRATEGY,
  DEFAULT_STRATEGY, // Must be last as fallback
]

/**
 * Find the appropriate extraction strategy for a given source identifier
 */
export function getExtractionStrategy(sourceIdentifier: string): ExtractionStrategy {
  for (const strategy of EXTRACTION_STRATEGIES) {
    if (strategy.emailPattern.test(sourceIdentifier)) {
      return strategy
    }
  }
  return DEFAULT_STRATEGY
}

/**
 * Generate an LLM-friendly prompt using the extraction strategy
 */
export function generateExtractionPrompt(
  strategy: ExtractionStrategy,
  emailContent: string,
  emailTitle: string,
  taxonomyTopics: string[]
): string {
  const adExclusionRules = strategy.adDetection.headerPatterns.length > 0
    ? `
CRITICAL EXCLUSION RULES:
${strategy.adDetection.headerPatterns.map(pattern => `- Skip any section with "${pattern}" in the header - this is sponsored content`).join('\n')}
${strategy.adDetection.promotionalPhrases.length > 0 ? `- Skip sections without a significance marker that contain promotional phrases like: ${strategy.adDetection.promotionalPhrases.join(', ')}` : ''}
${strategy.adDetection.skipSections.length > 0 ? `- Skip these sections entirely: ${strategy.adDetection.skipSections.join(', ')}` : ''}
`
    : ''

  const mainStoriesInstructions = `
1. MAIN STORIES (Priority: High, Relevancy: ${strategy.mainStories.relevancyRange[0]}-${strategy.mainStories.relevancyRange[1]})
   ${strategy.mainStories.sectionIndicators.length > 0 ? `- Look for sections with these indicators: ${strategy.mainStories.sectionIndicators.join(', ')}` : ''}
   ${strategy.mainStories.significanceMarker ? `- Each main story should have "${strategy.mainStories.significanceMarker}" analysis` : ''}
   - Title: ${strategy.mainStories.titleGuidance}
   - Description: ${strategy.mainStories.descriptionGuidance}
   - Include the significance analysis in the "content" field
   - Extract any URLs mentioned in the story
`

  const newsRoundupInstructions = strategy.newsRoundup
    ? `
2. NEWS ROUNDUP ITEMS (Priority: Medium-High, Relevancy: ${strategy.newsRoundup.relevancyRange[0]}-${strategy.newsRoundup.relevancyRange[1]})
   - Look for sections with these headers: ${strategy.newsRoundup.sectionHeaders.join(', ')}
   - Format: ${strategy.newsRoundup.itemFormat}
   - Extract EACH item as a separate nugget
   - Title: ${strategy.newsRoundup.titleGuidance}
   - Description: Use the 1-2 sentence summary provided
   - Content: null (these items are brief)
   - Extract embedded URLs
`
    : ''

  const taxonomyInstructions = `
TAXONOMY TOPICS (User's Interest Categories):
${taxonomyTopics.map(topic => `- ${topic}`).join('\n')}

You MUST assign exactly ONE taxonomy topic from the list above to each nugget.
Choose the most relevant category that best matches the nugget's primary subject matter.
`

  return `You are an AI assistant that extracts key insights (nuggets) from newsletter emails.

SOURCE: ${strategy.sourceName}
${adExclusionRules}
${taxonomyInstructions}

EXTRACTION STRATEGY:
${mainStoriesInstructions}${newsRoundupInstructions}

STRUCTURE NOTES:
${strategy.structureNotes}

Email Title: ${emailTitle}

Email Content:
${emailContent.substring(0, 12000)}${emailContent.length > 12000 ? '\n\n...(content truncated for length)' : ''}

Return your response as JSON in this exact format:
{
  "nuggets": [
    {
      "title": "string (10-60 chars) - Compelling headline",
      "description": "string (50-200 chars) - Brief explanation",
      "content": "string (optional) - Additional context or 'why it matters' analysis",
      "link": "string (optional) - URL if mentioned in the content",
      "relevancy_score": number (${strategy.mainStories.relevancyRange[0]}-${strategy.mainStories.relevancyRange[1]} for main stories, ${strategy.newsRoundup?.relevancyRange[0] || 60}-${strategy.newsRoundup?.relevancyRange[1] || 80} for news items),
      "topic": "string - EXACTLY ONE topic from the taxonomy list above",
      "tags": ["string", "string"] - 2-4 specific descriptive tags (companies, products, technologies, people)
    }
  ]
}

IMPORTANT:
- Extract ALL valid nuggets, not just 1-5. For this newsletter type, expect ${strategy.newsRoundup ? '8-12' : '3-5'} nuggets.
- Do NOT extract sponsored/promotional content.
- Each bullet point in news roundup sections is a separate nugget.
- The "topic" field must be ONE of the exact taxonomy topics listed above (structured categories for filtering).
- The "tags" field should contain 2-4 specific descriptive tags (e.g., "instagram", "deepseek-r1", "meta", "openai-funding").
- Return ONLY valid JSON, no markdown formatting or code blocks.`
}
