/**
 * Favicon Cache Utilities
 *
 * Provides localStorage-based caching for source favicons with:
 * - 7-day TTL (time to live)
 * - LRU eviction when exceeds 200 entries
 * - Domain extraction from URLs
 */

const CACHE_KEY = 'favicon_cache'
const TIMESTAMP_KEY = 'favicon_cache_timestamp'
const MAX_CACHE_SIZE = 200
const CACHE_TTL_DAYS = 7
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

interface FaviconCache {
  [domain: string]: {
    url: string
    lastAccessed: number
  }
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Get favicon cache from localStorage
 */
function getCache(): FaviconCache {
  if (!isLocalStorageAvailable()) return {}

  try {
    const cacheStr = localStorage.getItem(CACHE_KEY)
    return cacheStr ? JSON.parse(cacheStr) : {}
  } catch (error) {
    console.error('Failed to parse favicon cache:', error)
    return {}
  }
}

/**
 * Save favicon cache to localStorage
 */
function saveCache(cache: FaviconCache): void {
  if (!isLocalStorageAvailable()) return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.error('Failed to save favicon cache:', error)
    // If quota exceeded, clear cache and try again
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearFaviconCache()
    }
  }
}

/**
 * Check if cache needs refresh (7-day TTL)
 */
export function isCacheStale(): boolean {
  if (!isLocalStorageAvailable()) return false

  const timestamp = localStorage.getItem(TIMESTAMP_KEY)
  if (!timestamp) return true

  const age = Date.now() - parseInt(timestamp, 10)
  return age > CACHE_TTL_MS
}

/**
 * Get favicon URL from cache
 */
export function getFaviconFromCache(domain: string): string | null {
  const cache = getCache()
  const entry = cache[domain]

  if (!entry) return null

  // Update last accessed time
  entry.lastAccessed = Date.now()
  saveCache(cache)

  return entry.url
}

/**
 * Store favicon URL in cache
 */
export function setFaviconCache(domain: string, url: string): void {
  const cache = getCache()

  // Check if we need to evict entries
  if (Object.keys(cache).length >= MAX_CACHE_SIZE && !cache[domain]) {
    evictOldestCacheEntry()
  }

  cache[domain] = {
    url,
    lastAccessed: Date.now()
  }

  saveCache(cache)

  // Update timestamp on first write
  if (!localStorage.getItem(TIMESTAMP_KEY)) {
    localStorage.setItem(TIMESTAMP_KEY, Date.now().toString())
  }
}

/**
 * Evict oldest cache entry (LRU)
 */
export function evictOldestCacheEntry(): void {
  const cache = getCache()
  const entries = Object.entries(cache)

  if (entries.length === 0) return

  // Find entry with oldest lastAccessed time
  let oldestDomain = entries[0][0]
  let oldestTime = entries[0][1].lastAccessed

  for (const [domain, entry] of entries) {
    if (entry.lastAccessed < oldestTime) {
      oldestDomain = domain
      oldestTime = entry.lastAccessed
    }
  }

  delete cache[oldestDomain]
  saveCache(cache)
}

/**
 * Clear entire favicon cache
 */
export function clearFaviconCache(): void {
  if (!isLocalStorageAvailable()) return

  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(TIMESTAMP_KEY)
  } catch (error) {
    console.error('Failed to clear favicon cache:', error)
  }
}

/**
 * Get current cache size
 */
export function getCacheSize(): number {
  const cache = getCache()
  return Object.keys(cache).length
}

/**
 * Extract domain from URL
 * Examples:
 * - "https://techcrunch.com/2024/..." → "techcrunch.com"
 * - "http://www.example.com" → "example.com"
 * - "invalid-url" → null
 * - null → null
 */
export function extractDomain(url: string | null): string | null {
  if (!url) return null

  try {
    // Add protocol if missing
    let processedUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processedUrl = `https://${url}`
    }

    const urlObj = new URL(processedUrl)
    let hostname = urlObj.hostname

    // Remove 'www.' prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4)
    }

    return hostname
  } catch (error) {
    console.error('Failed to extract domain from URL:', url, error)
    return null
  }
}
