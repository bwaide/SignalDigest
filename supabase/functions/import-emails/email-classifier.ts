/**
 * Email Newsletter Classification
 *
 * Multi-signal approach to distinguish newsletters from:
 * - Personal emails
 * - Transactional emails (receipts, confirmations)
 * - System notifications
 * - Marketing emails
 */

export interface ClassificationResult {
  isNewsletter: boolean
  confidence: number  // 0-100
  signals: {
    sender: boolean      // Matched newsletter sender pattern
    structure: boolean   // Has newsletter structure
    headers: boolean     // Has list-unsubscribe headers
  }
  reason: string  // Why it was classified (for debugging)
}

interface EmailMessage {
  from: string
  fromName?: string
  bodyText: string
  bodyHtml?: string
  headers?: Record<string, string>
}

/**
 * Signal 1: Sender Pattern Matching
 *
 * Checks sender email address and name for newsletter indicators
 */
function checkSenderSignal(email: EmailMessage): boolean {
  const from = email.from.toLowerCase()
  const fromName = email.fromName?.toLowerCase() || ''

  // Negative patterns first (stronger signal) - indicates NOT a newsletter
  const personalPatterns = [
    /@gmail\.com$/,
    /@yahoo\.com$/,
    /@outlook\.com$/,
    /@hotmail\.com$/,
    /@icloud\.com$/,
    /^(receipt|invoice|order|shipping|support|billing|notification|alert)@/,
    // noreply@ but NOT from known newsletter platforms
    /^(noreply|no-reply|donotreply)@(?!.*(substack|beehiiv|convertkit|mailchimp|ghost))/,
  ]

  if (personalPatterns.some(p => p.test(from))) {
    return false
  }

  // Positive patterns - newsletter indicators
  const newsletterPatterns = [
    /^(newsletter|news|digest|brief|update|roundup)@/,
    /@(substack|beehiiv|convertkit|ghost|mailchimp)\.com$/,
    /^(team|hello|info)@.*\.(substack|beehiiv|convertkit)\.com$/,
  ]

  return newsletterPatterns.some(p => p.test(from) || p.test(fromName))
}

/**
 * Signal 2: Email Structure Analysis
 *
 * Analyzes HTML content for newsletter-specific patterns
 */
function checkStructureSignal(email: EmailMessage): boolean {
  const html = email.bodyHtml || ''
  const text = email.bodyText || ''

  let score = 0

  // 1. Has HTML content (newsletters are usually HTML-rich)
  if (html.length > 1000) score++

  // 2. Contains multiple links (newsletters link to articles)
  const linkCount = (html.match(/<a\s+href=/gi) || []).length
  if (linkCount >= 5) score++

  // 3. Contains images (newsletters often have logos/headers)
  const imgCount = (html.match(/<img\s+src=/gi) || []).length
  if (imgCount >= 2) score++

  // 4. Has "View in browser" link (common newsletter pattern)
  if (/view.*in.*browser/i.test(html) || /view.*online/i.test(html)) score++

  // 5. Has footer with organization info
  if (/<footer/i.test(html) || /©.*\d{4}/i.test(text)) score++

  // Threshold: 3 out of 5 structural signals
  return score >= 3
}

/**
 * Signal 3: Email Headers Check
 *
 * Checks for standard list management headers (RFC 2369)
 */
function checkHeadersSignal(email: EmailMessage): boolean {
  const headers = email.headers || {}

  // RFC 2369 - List management headers
  const hasListUnsubscribe = !!headers['list-unsubscribe'] || !!headers['List-Unsubscribe']
  const hasListId = !!headers['list-id'] || !!headers['List-ID']
  const hasPrecedenceBulk = headers['precedence']?.toLowerCase() === 'bulk' || headers['Precedence']?.toLowerCase() === 'bulk'

  // Any list header is strong signal
  return hasListUnsubscribe || hasListId || hasPrecedenceBulk
}

/**
 * Main classification function
 *
 * Combines all three signals with 2/3 threshold
 */
export function classifyEmail(email: EmailMessage): ClassificationResult {
  const senderSignal = checkSenderSignal(email)
  const structureSignal = checkStructureSignal(email)
  const headersSignal = checkHeadersSignal(email)

  // Count positive signals
  const signalCount = [senderSignal, structureSignal, headersSignal]
    .filter(Boolean).length

  // Decision logic: Need 2 out of 3 signals
  const isNewsletter = signalCount >= 2

  // Calculate confidence (0-100)
  const confidence = Math.round((signalCount / 3) * 100)

  // Generate reason for debugging
  const reason = `Signals: sender=${senderSignal}, structure=${structureSignal}, headers=${headersSignal} (${signalCount}/3)`

  return {
    isNewsletter,
    confidence,
    signals: {
      sender: senderSignal,
      structure: structureSignal,
      headers: headersSignal,
    },
    reason,
  }
}

/**
 * Simple boolean check for newsletter classification
 */
export function isNewsletter(email: EmailMessage): boolean {
  return classifyEmail(email).isNewsletter
}
