import type { ExtractionStrategy, PromptParams } from './types'

/**
 * Generic Extraction Strategy
 *
 * The default fallback strategy that works for most newsletter types.
 * Balanced approach that looks for key insights, interesting facts, and actionable items.
 * Suitable for mixed-content newsletters or when the newsletter type is unknown.
 */

export const genericStrategy: ExtractionStrategy = {
  id: 'generic',
  name: 'Generic',
  description: 'Balanced extraction for mixed-content newsletters. Works well as a fallback for unknown newsletter types.',
  expectedNuggetRange: [3, 10],

  buildPrompt: (params: PromptParams): string => {
    const { newsletterContent, userInterests, approvedTopics } = params

    return `You are an AI assistant specialized in extracting valuable nuggets of information from newsletters.

Your task is to analyze the following newsletter content and extract 3-10 nuggets of information. Each nugget should be:
- A standalone piece of valuable information
- Interesting, actionable, or insightful
- NOT advertisements, promotional content, or generic filler
- Properly categorized with relevant topics

User's interests: ${userInterests}

Approved topics: ${approvedTopics.join(', ')}

Newsletter content:
${newsletterContent}

For each nugget, provide:
1. title: A clear, descriptive title (max 100 characters)
2. content: The full extracted information, preserving important details and context
3. url: The source URL if mentioned, or null if not applicable
4. topics: Array of relevant topic tags from the approved list
5. relevancy_score: A score from 0-100 indicating relevance to the user's interests

Focus on extracting:
- Key insights and takeaways
- Interesting facts or statistics
- Actionable advice or tips
- Important announcements or updates
- Thought-provoking ideas

Skip:
- Advertisements and sponsored content
- Generic calls-to-action
- Newsletter metadata (unsubscribe links, social media, etc.)
- Repetitive or low-value content

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
