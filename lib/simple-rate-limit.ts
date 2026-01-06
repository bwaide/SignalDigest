/**
 * Simple in-memory rate limiter for single-user application
 *
 * This is suitable for development and small-scale production use.
 * For multi-user production, consider upgrading to Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class SimpleRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt < now) {
          this.store.delete(key)
        }
      }
    }, 5 * 60 * 1000)
  }

  /**
   * Check if a request should be rate limited
   *
   * @param key - Unique identifier (e.g., userId)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Object with success status and reset time
   */
  check(
    key: string,
    limit: number,
    windowMs: number
  ): { success: boolean; limit: number; remaining: number; reset: Date } {
    const now = Date.now()
    const entry = this.store.get(key)

    // No entry or window expired - start fresh
    if (!entry || entry.resetAt < now) {
      const resetAt = now + windowMs
      this.store.set(key, { count: 1, resetAt })
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: new Date(resetAt),
      }
    }

    // Within window - check if limit exceeded
    if (entry.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: new Date(entry.resetAt),
      }
    }

    // Increment count
    entry.count++
    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: new Date(entry.resetAt),
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  status(key: string, limit: number, windowMs: number): {
    remaining: number
    reset: Date
  } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || entry.resetAt < now) {
      return {
        remaining: limit,
        reset: new Date(now + windowMs),
      }
    }

    return {
      remaining: Math.max(0, limit - entry.count),
      reset: new Date(entry.resetAt),
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clear all rate limit entries
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Cleanup interval timer (called automatically)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
const rateLimiter = new SimpleRateLimiter()

// Export configured rate limiters for different operations
export const rateLimiters = {
  /**
   * Email import: 30 requests per hour
   * Prevents IMAP account bans from excessive connections
   */
  emailImport: (userId: string) =>
    rateLimiter.check(`email-import:${userId}`, 30, 60 * 60 * 1000),

  /**
   * Signal processing: 20 requests per hour
   * Prevents excessive LLM API costs
   */
  signalProcess: (userId: string) =>
    rateLimiter.check(`signal-process:${userId}`, 20, 60 * 60 * 1000),

  /**
   * Auto-sync schedule changes: 10 requests per hour
   * Prevents abuse of pg_cron job creation
   */
  autoSyncSchedule: (userId: string) =>
    rateLimiter.check(`auto-sync-schedule:${userId}`, 10, 60 * 60 * 1000),

  /**
   * Settings updates: 20 requests per hour
   * Prevents excessive database writes
   */
  settingsUpdate: (userId: string) =>
    rateLimiter.check(`settings-update:${userId}`, 20, 60 * 60 * 1000),

  /**
   * Read operations: 200 requests per minute
   * High limit for normal browsing, but prevents database spam
   */
  readOperations: (userId: string) =>
    rateLimiter.check(`read-ops:${userId}`, 200, 60 * 1000),
}

/**
 * Helper to get rate limit status without incrementing
 */
export const getRateLimitStatus = {
  emailImport: (userId: string) =>
    rateLimiter.status(`email-import:${userId}`, 30, 60 * 60 * 1000),
  signalProcess: (userId: string) =>
    rateLimiter.status(`signal-process:${userId}`, 20, 60 * 60 * 1000),
  autoSyncSchedule: (userId: string) =>
    rateLimiter.status(`auto-sync-schedule:${userId}`, 10, 60 * 60 * 1000),
}

/**
 * Reset rate limits (useful for testing)
 */
export const resetRateLimit = (userId: string, operation: string) => {
  rateLimiter.reset(`${operation}:${userId}`)
}

/**
 * Clear all rate limits (useful for testing)
 */
export const clearAllRateLimits = () => {
  rateLimiter.clear()
}

export default rateLimiter
