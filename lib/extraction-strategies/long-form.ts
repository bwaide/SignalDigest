import type { ExtractionStrategy, PromptParams } from './types'

/**
 * Long-Form Deep Dive Strategy
 *
 * Specialized for newsletters that feature in-depth analysis and essay-style content
 * (e.g., Stratechery, Benedict Evans, Wait But Why).
 *
 * Key characteristics:
 * - Single main essay or 2-3 detailed articles
 * - Deep analysis with multiple key arguments
 * - Each piece has several important takeaways
 * - Fewer total items but richer content per item
 */

export const longFormStrategy: ExtractionStrategy = {
  id: 'long-form-deep-dive',
  name: 'Long-form Deep Dive',
  description: 'Optimized for in-depth analysis and essay-style newsletters. Extracts key arguments and insights from detailed content.',
  expectedNuggetRange: [3, 8],

  buildPrompt: (params: PromptParams): string => {
    const { newsletterContent, userInterests, approvedTopics } = params

    return `You are an AI assistant specialized in extracting valuable nuggets from long-form analytical newsletters.

Your task is to analyze this in-depth newsletter and extract 3-8 high-quality nuggets. This newsletter likely contains:
- One main essay or 2-3 detailed articles
- Deep analysis with multiple interconnected arguments
- Rich context and supporting evidence
- Thoughtful conclusions and implications

User's interests: ${userInterests}

Approved topics: ${approvedTopics.join(', ')}

Newsletter content:
${newsletterContent}

EXTRACTION APPROACH:
For long-form content, focus on extracting:
1. Core thesis or main argument
2. Key supporting points and evidence
3. Interesting insights or novel perspectives
4. Important implications or conclusions
5. Actionable takeaways

Each nugget should:
1. title: A clear title capturing the key point (max 100 characters)
2. content: A comprehensive summary that preserves the argument's nuance and context. Include relevant details, examples, and reasoning. This should be substantial (200-500 words for main points).
3. url: The source URL if this references external content, or null for the essay itself
4. topics: Relevant topic tags from the approved list
5. relevancy_score: Score 0-100 based on user's interests

QUALITY OVER QUANTITY:
- It's better to extract 3-5 excellent nuggets than 10 mediocre ones
- Each nugget should capture a distinct, valuable insight
- Preserve the depth and nuance of the original analysis
- Don't split a single coherent argument into multiple nuggets
- Combine related points if they form a stronger unified insight

WHAT TO SKIP:
- Newsletter metadata and formatting
- Generic introductions or sign-offs
- Subscription pitches
- Tangential asides that don't contribute to main arguments

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
