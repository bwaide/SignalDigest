import type { ExtractionStrategy, PromptParams } from './types'

/**
 * News Digest Strategy
 *
 * Specialized for daily/weekly news roundup newsletters with brief summaries
 * (e.g., Axios, The Hustle, TLDR).
 *
 * Key characteristics:
 * - Multiple news items (5-15)
 * - Consistent formatting: headline + brief summary
 * - Each item is self-contained
 * - Focus on what happened and why it matters
 */

export const newsDigestStrategy: ExtractionStrategy = {
  id: 'news-digest',
  name: 'News Digest',
  description: 'Optimized for news roundup newsletters with brief summaries. Extracts individual news items efficiently.',
  expectedNuggetRange: [5, 15],

  buildPrompt: (params: PromptParams): string => {
    const { newsletterContent, userInterests, approvedTopics } = params

    return `You are an AI assistant specialized in extracting valuable nuggets from news digest newsletters.

Your task is to analyze this news roundup and extract 5-15 nuggets. This newsletter likely contains:
- Multiple news items with headlines and brief summaries
- Consistent formatting across items
- Focus on recent events and developments
- "Why it matters" or context sections

User's interests: ${userInterests}

Approved topics: ${approvedTopics.join(', ')}

Newsletter content:
${newsletterContent}

EXTRACTION APPROACH:
For each news item:
1. title: The headline or main topic (max 100 characters)
2. content: Combine the summary with any "why it matters" context. Make it comprehensive enough to understand the news without reading the source.
3. url: Link to the full story if provided, or null
4. topics: Relevant topic tags from the approved list
5. relevancy_score: Score 0-100 based on user's interests

Focus on:
- Actual news and developments
- Updates with clear impact or significance
- Items with concrete information (not speculation)
- Stories relevant to user's interests

WHAT TO SKIP:
- Generic news without substance
- Items that are just headlines without context
- Promotional content disguised as news
- Newsletter formatting and metadata
- Social media links and CTAs

HANDLING COMMON PATTERNS:
- "Why it matters:" sections should be integrated into the content
- "The big picture:" provides valuable context - include it
- "Between the lines:" offers analysis - definitely extract
- Statistics and data points are valuable - preserve them
- Quotes from key figures add credibility - include when relevant

Return your response as a JSON object with this structure:
{
  "nuggets": [
    {
      "title": "...",
      "content": "...",
      "url": "..." or null,
      "topics": ["topic1", "topic2"],
      "relevancy_score": 85
    }
  ]
}`
  }
}
