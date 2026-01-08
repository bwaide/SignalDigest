/**
 * Extraction Strategies Registry
 *
 * Central registry for all extraction strategies. Provides a single point
 * to access and manage different extraction approaches.
 */

import { genericStrategy } from './generic'
import { adHeavyStrategy } from './ad-heavy'
import { longFormStrategy } from './long-form'
import { newsDigestStrategy } from './news-digest'
import type { ExtractionStrategy, StrategyId } from './types'

export * from './types'

/**
 * Registry of all available extraction strategies
 */
export const STRATEGIES: Record<StrategyId, ExtractionStrategy> = {
  'generic': genericStrategy,
  'ad-heavy-link-listing': adHeavyStrategy,
  'long-form-deep-dive': longFormStrategy,
  'news-digest': newsDigestStrategy,
}

/**
 * Get an extraction strategy by ID
 *
 * @param id - Strategy identifier
 * @returns The requested strategy, or generic as fallback
 */
export function getStrategy(id: string): ExtractionStrategy {
  const strategy = STRATEGIES[id as StrategyId]

  if (!strategy) {
    console.warn(`Unknown extraction strategy: ${id}, falling back to generic`)
    return STRATEGIES.generic
  }

  return strategy
}

/**
 * List all available strategies with their metadata
 *
 * @returns Array of strategy metadata
 */
export function listStrategies() {
  return Object.values(STRATEGIES).map(strategy => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    expectedNuggetRange: strategy.expectedNuggetRange,
  }))
}
