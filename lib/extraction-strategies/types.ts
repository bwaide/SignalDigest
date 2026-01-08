/**
 * Extraction Strategy Types
 *
 * Defines the interfaces for the extraction strategy system.
 * Each strategy provides a specialized approach to extracting nuggets
 * from different types of newsletter content.
 */

export interface PromptParams {
  newsletterContent: string
  userInterests: string
  approvedTopics: string[]
  customConfig?: Record<string, string | number | boolean>
}

export interface ExtractionStrategy {
  id: string
  name: string
  description: string
  buildPrompt: (params: PromptParams) => string
  expectedNuggetRange: [number, number]
}

export type StrategyId = 'generic' | 'ad-heavy-link-listing' | 'long-form-deep-dive' | 'news-digest'
