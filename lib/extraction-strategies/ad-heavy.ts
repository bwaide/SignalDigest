import type { ExtractionStrategy, PromptParams } from './types'

/**
 * Ad-Heavy Link Listing Strategy
 *
 * Specialized for newsletters that present curated links with brief descriptions,
 * often interspersed with ads and sponsored content (e.g., The Rundown AI, Morning Brew).
 *
 * Key characteristics:
 * - Multiple short items (10-20+)
 * - Each item typically has: headline + 1-2 sentence description + link
 * - Ads mixed throughout (needs aggressive filtering)
 * - Focus on extracting the substantive links, not the ads
 */

export const adHeavyStrategy: ExtractionStrategy = {
  id: 'ad-heavy-link-listing',
  name: 'Ad-Heavy Link Listing',
  description: 'Optimized for curated link newsletters with heavy advertising. Filters out ads and extracts substantive content.',
  expectedNuggetRange: [8, 20],

  buildPrompt: (params: PromptParams): string => {
    const { newsletterContent, userInterests, approvedTopics } = params

    return `You are an AI assistant specialized in extracting valuable nuggets from ad-heavy curated link newsletters.

Your task is to analyze this newsletter and extract 8-20 nuggets. This newsletter likely contains:
- Multiple curated links with brief descriptions
- Advertisements and sponsored content interspersed throughout
- Calls-to-action and promotional material

User's interests: ${userInterests}

Approved topics: ${approvedTopics.join(', ')}

Newsletter content:
${newsletterContent}

CRITICAL FILTERING INSTRUCTIONS:
You MUST aggressively filter out:
- Sponsored content and advertisements
- Product promotions (unless genuinely newsworthy)
- Newsletter subscription CTAs
- Generic "learn more" or "click here" content
- Social media follow requests
- Referral programs

WHAT TO EXTRACT:
For each substantive item in the newsletter:
1. title: The headline or main topic (max 100 characters)
2. content: The description provided in the newsletter, expanded if necessary for clarity
3. url: The actual article/resource URL (REQUIRED - skip items without a substantive external link)
4. topics: Relevant topic tags from the approved list
5. relevancy_score: Score 0-100 based on user's interests

Focus on items that:
- Link to external articles, tools, or resources
- Provide genuinely interesting information or insights
- Have educational or practical value
- Are newsworthy or thought-provoking

PATTERN RECOGNITION:
- Ads often have language like "Sponsored", "Partner", "Brought to you by"
- Ads often focus on selling rather than informing
- Substantive items typically have clear external sources (news sites, research papers, tools)
- If unsure whether something is an ad, err on the side of excluding it

Return your response as a JSON object with this structure:
{
  "nuggets": [
    {
      "title": "...",
      "content": "...",
      "url": "https://...",
      "topics": ["topic1", "topic2"],
      "relevancy_score": 85
    }
  ]
}`
  }
}
