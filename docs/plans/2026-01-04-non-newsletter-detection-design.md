# Non-Newsletter Detection Design

**Created**: January 4, 2026
**Status**: Approved
**Priority**: #3 Enhancement

## Overview

Add intelligent email classification to filter out personal emails, transactional emails, and marketing emails from newsletter processing. Only emails classified as newsletters will be stored as signals for nugget extraction.

## Goals

1. **Reduce Noise**: Prevent non-newsletter emails from cluttering the signals database
2. **Improve Quality**: Focus processing power on actual newsletter content
3. **Save Resources**: Avoid unnecessary AI extraction calls for irrelevant emails
4. **Maintain Accuracy**: Use multi-signal approach to minimize false negatives (accidentally skipping real newsletters)

## Technical Approach

### Multi-Signal Classification

Combine three independent detection methods:
- **Sender Pattern Matching** - Identifies newsletter-specific sender addresses
- **Email Structure Analysis** - Detects newsletter HTML structure patterns
- **Email Headers Check** - Looks for standard list management headers (RFC 2369)

**Decision Logic**: Email is classified as newsletter if **2 out of 3 signals** are positive (66% threshold)

## Component Architecture

### New Module: `EmailClassifier`

**Location**: `supabase/functions/import-emails/email-classifier.ts`

**Responsibilities**:
- Analyze email metadata, structure, and headers
- Score each signal independently
- Combine signals with confidence scoring
- Provide classification decision and debugging info

**Exports**:
```typescript
export interface ClassificationResult {
  isNewsletter: boolean
  confidence: number  // 0-100
  signals: {
    sender: boolean      // Matched newsletter sender pattern
    structure: boolean   // Has newsletter structure
    headers: boolean     // Has list-unsubscribe headers
  }
  reason?: string  // Why it was classified (for debugging)
}

export function isNewsletter(email: EmailMessage): boolean
export function classifyEmail(email: EmailMessage): ClassificationResult
```

### Integration Point

Modify `supabase/functions/import-emails/index.ts`:
- Import `isNewsletter()` from classifier module
- Filter emails before storing as signals
- Log skipped emails with sender and subject for debugging

## Signal Detection Methods

### Signal 1: Sender Pattern Matching

Analyzes `From` address and sender name for newsletter indicators.

**Positive Patterns** (indicates newsletter):
- Newsletter-specific prefixes: `newsletter@`, `news@`, `digest@`, `brief@`, `update@`, `roundup@`
- Known newsletter platforms: `@substack.com`, `@beehiiv.com`, `@convertkit.com`, `@ghost.com`, `@mailchimp.com`
- Common newsletter senders: `team@`, `hello@`, `info@` (when from known platforms)

**Negative Patterns** (indicates NOT newsletter - checked first):
- Personal email providers: `@gmail.com`, `@yahoo.com`, `@outlook.com`
- Transactional prefixes: `receipt@`, `invoice@`, `order@`, `shipping@`, `support@`, `billing@`, `notification@`, `alert@`
- Generic `noreply@` domains (excluding newsletter platforms): `noreply@ionos.de`, `noreply@company.com`

**Implementation**:
```typescript
function checkSenderSignal(email: EmailMessage): boolean {
  const from = email.from.address.toLowerCase()
  const fromName = email.from.name?.toLowerCase() || ''

  // Negative patterns first (stronger signal) - EXPANDED
  const personalPatterns = [
    /@gmail\.com$/, /@yahoo\.com$/, /@outlook\.com$/,
    /^(receipt|invoice|order|shipping|support|billing|notification|alert)@/,
    /^(noreply|no-reply|donotreply)@(?!.*(substack|beehiiv|convertkit|mailchimp|ghost))/,  // noreply BUT NOT from newsletter platforms
  ]

  if (personalPatterns.some(p => p.test(from))) {
    return false
  }

  // Positive patterns - newsletter platforms only
  const newsletterPatterns = [
    /^(newsletter|news|digest|brief|update|roundup)@/,
    /@(substack|beehiiv|convertkit|ghost|mailchimp)\.com$/,
    /^(team|hello|info)@.*\.(substack|beehiiv|convertkit)\.com$/,
  ]

  return newsletterPatterns.some(p => p.test(from) || p.test(fromName))
}
```

**Key Design Decision**: Negative patterns checked first to avoid false positives from `noreply@` addresses that aren't newsletters (e.g., `noreply@ionos.de` spam reports).

### Signal 2: Email Structure Analysis

Analyzes HTML content for newsletter-specific structural patterns.

**Scoring Criteria** (need 3 out of 5):
1. **HTML-rich content**: `html.length > 1000` characters
2. **Multiple article links**: 5+ `<a href>` tags (newsletters link to multiple articles)
3. **Images present**: 2+ `<img>` tags (newsletters have logos/headers/article images)
4. **View-in-browser link**: Contains "view in browser" or "view online" text
5. **Professional footer**: Has `<footer>` tag or copyright notice (`© 2024`)

**Implementation**:
```typescript
function checkStructureSignal(email: EmailMessage): boolean {
  const html = email.html || ''
  const text = email.text || ''

  let score = 0

  // Has HTML content (newsletters are usually HTML-rich)
  if (html.length > 1000) score++

  // Contains multiple links (newsletters link to articles)
  const linkCount = (html.match(/<a\s+href=/gi) || []).length
  if (linkCount >= 5) score++

  // Contains images (newsletters often have logos/headers)
  const imgCount = (html.match(/<img\s+src=/gi) || []).length
  if (imgCount >= 2) score++

  // Has "View in browser" link (common newsletter pattern)
  if (/view.*in.*browser/i.test(html) || /view.*online/i.test(html)) score++

  // Has footer with organization info
  if (/<footer/i.test(html) || /©.*\d{4}/i.test(text)) score++

  // Threshold: 3 out of 5 structural signals
  return score >= 3
}
```

**Rationale**: Plain-text transactional emails will score 0-1. Simple marketing emails might score 2. Rich newsletters typically score 4-5.

### Signal 3: Email Headers Check

Checks for standard list management headers defined in RFC 2369.

**Headers Checked**:
- `List-Unsubscribe`: Standard unsubscribe mechanism
- `List-ID`: Mailing list identifier
- `Precedence: bulk`: Bulk mailing indicator

**Implementation**:
```typescript
function checkHeadersSignal(email: EmailMessage): boolean {
  const headers = email.headers || {}

  // RFC 2369 - List management headers
  const hasListUnsubscribe = !!headers['list-unsubscribe']
  const hasListId = !!headers['list-id']
  const hasPrecedenceBulk = headers['precedence']?.toLowerCase() === 'bulk'

  // Any list header is strong signal
  return hasListUnsubscribe || hasListId || hasPrecedenceBulk
}
```

**Rationale**: These headers are legally required in many jurisdictions for bulk email. Most legitimate newsletters include them. Transactional/personal emails won't have them.

## Classification Logic

### Main Classification Function

```typescript
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
  let reason = `Signals: sender=${senderSignal}, structure=${structureSignal}, headers=${headersSignal}`

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

export function isNewsletter(email: EmailMessage): boolean {
  return classifyEmail(email).isNewsletter
}
```

### Classification Examples

**Example 1: TechCrunch Newsletter**
- Sender: `newsletter@techcrunch.com` ✓
- Structure: Rich HTML, 10+ links, images, footer ✓
- Headers: `List-Unsubscribe` present ✓
- **Result**: 3/3 signals → Newsletter (100% confidence) ✓

**Example 2: Personal Email**
- Sender: `friend@gmail.com` ✗ (personal domain)
- Structure: Plain text, 1 link ✗
- Headers: No list headers ✗
- **Result**: 0/3 signals → Not newsletter ✓

**Example 3: Transactional Email (Order Receipt)**
- Sender: `orders@amazon.com` ✗ (transactional prefix)
- Structure: HTML template, 3 links, logo ✗ (below threshold)
- Headers: No list headers ✗
- **Result**: 0/3 signals → Not newsletter ✓

**Example 4: Spam Report (IONOS)**
- Sender: `noreply@ionos.de` ✗ (noreply but not newsletter platform)
- Structure: Plain text, 1 link ✗
- Headers: `Auto-Submitted: auto-generated` ✗ (not list header)
- **Result**: 0/3 signals → Not newsletter ✓

**Example 5: Substack Newsletter (Edge Case)**
- Sender: `john@example.com` ✗ (personal domain, but via Substack)
- Structure: Rich HTML, 8 links, images, footer ✓
- Headers: `List-Unsubscribe` present ✓
- **Result**: 2/3 signals → Newsletter (67% confidence) ✓

## Integration into Email Import Flow

### Modified `fetchUnreadEmails()` Function

```typescript
import { isNewsletter, classifyEmail } from './email-classifier.ts'

async function fetchUnreadEmails(client: ImapFlow, limit: number = 50): Promise<EmailMessage[]> {
  await client.mailboxOpen('INBOX')
  const searchResults = await client.search({ seen: false }, { uid: true })

  if (!searchResults || searchResults.length === 0) {
    return []
  }

  const uids = searchResults.slice(0, limit)
  const emails: EmailMessage[] = []
  let skippedCount = 0

  for await (const message of client.fetch(uids, {
    envelope: true,
    bodyStructure: true,
    source: true,
  })) {
    const email = await parseEmail(message)

    // NEW: Filter non-newsletters
    const classification = classifyEmail(email)

    if (!classification.isNewsletter) {
      console.log(`Skipping non-newsletter (confidence: ${classification.confidence}%):`, {
        from: email.from.address,
        subject: email.subject,
        signals: classification.signals,
        reason: classification.reason
      })
      skippedCount++
      continue
    }

    console.log(`Accepting newsletter (confidence: ${classification.confidence}%):`, {
      from: email.from.address,
      subject: email.subject,
      signals: classification.signals
    })

    emails.push(email)
  }

  console.log(`Fetched ${emails.length} newsletters, skipped ${skippedCount} non-newsletters`)
  return emails
}
```

### Flow Diagram

```
IMAP Fetch Unread Emails
    ↓
For each email:
    ↓
parseEmail() → EmailMessage
    ↓
classifyEmail() → ClassificationResult
    ↓
Is newsletter? (2/3 signals)
    ├─ YES → Add to emails array → Store as signal
    └─ NO  → Log and skip → Continue to next email
    ↓
Return filtered emails (newsletters only)
```

## Testing Strategy

### Unit Tests

Test each signal function independently:

```typescript
// Test sender signal
describe('checkSenderSignal', () => {
  test('newsletter@domain.com → true')
  test('noreply@substack.com → true')
  test('noreply@ionos.de → false')
  test('friend@gmail.com → false')
  test('receipt@amazon.com → false')
})

// Test structure signal
describe('checkStructureSignal', () => {
  test('HTML newsletter with 10 links, images, footer → true')
  test('Plain text email → false')
  test('Simple HTML email with 2 links → false')
})

// Test headers signal
describe('checkHeadersSignal', () => {
  test('Has List-Unsubscribe → true')
  test('Has Precedence: bulk → true')
  test('No list headers → false')
})
```

### Integration Tests

Test with real email samples:

1. **TechCrunch newsletter** → Should classify as newsletter
2. **Personal Gmail** → Should classify as non-newsletter
3. **Amazon order receipt** → Should classify as non-newsletter
4. **IONOS spam report** → Should classify as non-newsletter
5. **Substack newsletter** → Should classify as newsletter (even with personal sender)

### Production Testing

1. Deploy to Edge Function
2. Monitor classification logs for 1 week
3. Review skipped emails to check for false negatives
4. Adjust patterns if needed based on real-world data

## Error Handling

### Missing Data

- If `email.html` is null/undefined, structure signal returns false (safe default)
- If `email.headers` is null/undefined, headers signal returns false (safe default)
- If `email.from.address` is malformed, sender signal returns false (safe default)

### False Negatives (Skipping Real Newsletters)

**Risk**: Some newsletters might not match 2/3 signals and get skipped

**Mitigation**:
- Log all skipped emails with classification details
- Monitor logs for patterns of missed newsletters
- Iterate on patterns based on real-world data
- User can manually trigger re-import if needed

### False Positives (Accepting Non-Newsletters)

**Risk**: Marketing emails or sophisticated spam might pass as newsletters

**Impact**: Lower than false negatives (extracting from non-newsletter is wasteful but not breaking)

**Mitigation**:
- Nugget extraction has its own quality filters (relevancy scoring)
- User can archive unwanted nuggets
- Patterns can be tightened if false positive rate is high

## Performance Impact

### Processing Overhead

- Classification runs on each fetched email (before storing)
- Pattern matching is regex-based (very fast, < 1ms per email)
- HTML parsing uses simple regex (no DOM parsing needed)
- Total overhead: ~2-5ms per email

### Network Impact

- No additional network calls (uses existing email data)
- Reduces downstream processing (fewer signals stored)
- Reduces AI Gateway calls (fewer nugget extractions)
- **Net positive**: Saves more resources than it consumes

### Storage Impact

- Reduces signals table growth (only newsletters stored)
- Cleaner data, easier debugging
- Better signal-to-noise ratio

## Future Enhancements

### Machine Learning Classification

- Collect classification decisions and user feedback
- Train ML model to improve accuracy over time
- Use confidence scores to prioritize training data

### User Allowlist/Blocklist

- Allow users to manually mark senders as "always newsletter" or "never newsletter"
- Store in `user_settings` table
- Check allowlist/blocklist before pattern matching

### Classification Analytics

- Track classification accuracy metrics
- Monitor false positive/negative rates
- Dashboard showing skipped emails for review

### Adaptive Patterns

- Automatically detect new newsletter platforms
- Learn from user corrections
- Update patterns without code changes

## Acceptance Criteria

### Functionality
- [ ] Classifier module correctly identifies newsletters vs. non-newsletters
- [ ] Email import skips non-newsletters before storing signals
- [ ] Classification decisions logged with reasoning for debugging
- [ ] All three signals (sender, structure, headers) working correctly
- [ ] 2/3 signal threshold correctly enforced

### Accuracy
- [ ] TechCrunch/Substack newsletters classified correctly (newsletter)
- [ ] Personal Gmail emails classified correctly (non-newsletter)
- [ ] Transactional receipts classified correctly (non-newsletter)
- [ ] IONOS spam reports classified correctly (non-newsletter)
- [ ] False negative rate < 5% (tested with sample of 50+ newsletters)

### Performance
- [ ] Classification overhead < 5ms per email
- [ ] No degradation in email import time
- [ ] Reduced downstream processing (fewer signals stored)

### Observability
- [ ] Console logs show skipped emails with details
- [ ] Console logs show accepted newsletters with confidence scores
- [ ] Easy to debug classification decisions from logs

## Rollout Plan

### Phase 1: Implementation
1. Create `email-classifier.ts` module
2. Implement three signal functions
3. Implement classification logic
4. Write unit tests

### Phase 2: Integration
1. Modify `import-emails/index.ts` to use classifier
2. Add detailed logging
3. Test locally with sample emails

### Phase 3: Production Testing
1. Deploy to Edge Function
2. Monitor logs for 1 week
3. Collect metrics on classification decisions
4. Review any false negatives/positives

### Phase 4: Iteration
1. Adjust patterns based on production data
2. Add any missing sender domains
3. Fine-tune structure scoring thresholds
4. Document common edge cases

## Related Files

**New Files**:
- `supabase/functions/import-emails/email-classifier.ts` - Classification module

**Modified Files**:
- `supabase/functions/import-emails/index.ts` - Integration

**Documentation**:
- `docs/plans/2026-01-04-non-newsletter-detection-design.md` - This file
