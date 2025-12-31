# Email Importing & Parsing - Design Document

**Date:** December 31, 2025
**Status:** Approved for Implementation
**Feature:** Email Importing and Content Extraction

## Overview

Implement the email importing system that connects to the user's configured IMAP account, fetches unread emails, parses and extracts content, and creates Signal records in the database for further AI processing.

## Architecture

### Core Flow

1. **Trigger:** User clicks "Check Now" button in Header
2. **Next.js API Route:** `/api/emails/import` validates request, invokes Edge Function
3. **Edge Function:** `import-emails` performs the actual import
   - Retrieves email config from `user_settings.signal_sources`
   - Fetches password from Supabase Vault using `vault_secret_id`
   - Connects to IMAP server
   - Fetches unread emails from INBOX (max 50 per batch)
   - Parses each email (subject, body, sender, date)
   - Creates `signal` records in database
   - Marks emails as SEEN in mailbox
   - Returns summary (X emails imported, Y failed)
4. **Response:** API returns results to frontend, button updates with status

### Components

**Frontend:**
- Header "Check Now" button with loading/success/error states
- Toast notifications for import results

**Backend:**
- API Route: `/app/api/emails/import/route.ts`
- Edge Function: `supabase/functions/import-emails/index.ts`

**Libraries:**
- IMAP: `imap` (npm package for Deno)
- HTML parsing: `@mozilla/readability` or `linkedom` + `@mozilla/readability`
- HTML to text: Use Readability's text extraction

## Email Processing Details

### Fetching Strategy

- **IMAP Query:** Search for UNSEEN emails in INBOX
- **Batch Size:** Maximum 50 emails per invocation (prevent timeout)
- **Sorting:** Fetch oldest first (FIFO processing)
- **Marking:** Mark as SEEN after successful import
- **Timeout:** Edge Function has 60-second timeout

### Content Extraction

**Email Formats Handled:**
1. **Plain text only** → Use as-is
2. **HTML only** → Use @mozilla/readability to extract main content
3. **Multipart (HTML + plain text)** → Prefer plain text, fallback to HTML extraction

**Readability Processing:**
- Extract article content from HTML emails (removes ads, footers, etc.)
- Preserves important structure and links
- Provides clean text suitable for AI processing
- Falls back to raw HTML-to-text if Readability fails

**Fields Extracted:**
```typescript
{
  subject: string           // Email subject line
  from: string             // Sender email address
  fromName?: string        // Sender display name
  date: Date               // Email received date
  bodyText: string         // Cleaned text content (via Readability or plain text)
  messageId: string        // Unique email identifier (for deduplication)
  hasAttachments: boolean
  to?: string[]            // Recipients
  cc?: string[]            // CC recipients
}
```

### Deduplication

**Strategy:**
- Use email `messageId` as unique identifier
- Check if signal with `metadata.message_id` already exists
- Skip import if duplicate found
- Count as "skipped" in response

**Database Query:**
```sql
SELECT id FROM signals
WHERE user_id = $1
  AND metadata->>'message_id' = $2
LIMIT 1
```

### Signal Record Structure

```typescript
{
  user_id: UUID,
  signal_type: 'email',
  title: email.subject,
  raw_content: email.bodyText,  // Extracted via Readability or plain text
  source_identifier: email.from,
  source_url: null,  // Emails don't have URLs
  received_date: email.date,
  status: 'pending',
  metadata: {
    message_id: email.messageId,
    from_name: email.fromName,
    has_attachments: boolean,
    to: email.to,
    cc: email.cc
  }
}
```

## Error Handling

### Error Categories

**1. Connection Errors:**
- IMAP connection fails → Return error response, update source status
- Authentication fails → Return 401 error, suggest re-configuring
- Timeout during fetch → Return partial success with imported count
- Network issues → Return error with retry suggestion

**2. Parsing Errors:**
- Malformed email → Skip email, log to `processing_errors`, continue
- Unsupported encoding → Best-effort decode, log warning, continue
- Missing required fields → Use defaults (e.g., "(No Subject)"), continue
- Readability fails → Fallback to basic HTML-to-text conversion

**3. Database Errors:**
- Signal insert fails → Rollback batch, retry individual emails
- Duplicate messageId → Skip silently (already imported)
- RLS policy violation → Log critical error, abort

### Retry Strategy

- Failed emails remain UNSEEN in mailbox
- User can click "Check Now" again to retry
- Each email tracks retry count in metadata
- After 3 consecutive failures, log to `processing_errors` table

### Error Logging

**processing_errors table:**
```typescript
{
  signal_id: null,  // No signal created yet
  error_type: 'email_parse_error' | 'imap_error' | 'database_error',
  error_message: string,
  stack_trace: string,
  occurred_at: timestamp,
  resolved: false
}
```

## User Feedback

### "Check Now" Button States

**Idle:**
- Label: "🔄 Check Now"
- Enabled: If email configured and status = 'connected'
- Disabled: If email not configured or status = 'failed'

**Checking:**
- Label: "Checking..."
- Spinner animation
- Button disabled

**Success:**
- Label: "✓ Imported X emails" (3 seconds)
- Green background flash
- Returns to "🔄 Check Now" after 3s

**Partial Success:**
- Label: "⚠ Imported X of Y emails"
- Orange background
- Clickable to show error details modal

**Error:**
- Label: "✗ Check failed"
- Red background
- Clickable to show error details modal

### API Response Format

```typescript
{
  success: boolean;
  imported: number;      // Count of successfully imported emails
  failed: number;        // Count of failed emails
  skipped: number;       // Count of duplicates skipped
  hasMore: boolean;      // True if 50+ unread emails remain
  errors?: Array<{       // Details for failed imports (if any)
    subject: string;     // Email subject or messageId
    from: string;        // Sender
    error: string;       // Error message
  }>;
}
```

### Toast Notifications

**Success:**
- Message: "Imported 23 new emails"
- Type: Success (green)
- Duration: 3 seconds

**Partial:**
- Message: "Imported 20 emails, 3 failed"
- Type: Warning (orange)
- Duration: 5 seconds
- Action: "View Details"

**Error:**
- Message: "Email import failed: [reason]"
- Type: Error (red)
- Duration: 5 seconds
- Action: "Retry"

## Implementation Details

### Edge Function Structure

**File:** `supabase/functions/import-emails/index.ts`

**Main Flow:**
```typescript
1. Authenticate request (verify user)
2. Get email config from user_settings
3. Retrieve password from Vault
4. Connect to IMAP server
5. Search for UNSEEN emails (limit 50)
6. For each email:
   a. Parse headers and body
   b. Check for duplicates (messageId)
   c. Extract content (Readability or plain text)
   d. Create signal record
   e. Mark email as SEEN
7. Return summary response
```

**Dependencies (Deno):**
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ImapFlow } from 'npm:imapflow@1'
import { Readability } from 'npm:@mozilla/readability@0'
import { JSDOM } from 'npm:jsdom@23'
```

### Next.js API Route

**File:** `app/api/emails/import/route.ts`

**Responsibilities:**
- Validate user authentication
- Check email configuration exists
- Invoke Edge Function via HTTP
- Return response to frontend

**Security:**
- Require authenticated user (or DEV_MODE bypass)
- Rate limiting: Max 1 request per 10 seconds per user
- Check email source status = 'connected'

### Frontend Integration

**Header Component Changes:**
- Enable "Check Now" button when email configured
- Add click handler to call `/api/emails/import`
- Show button state transitions (checking, success, error)
- Display toast notifications based on response

**State Management:**
- Add `isChecking` state to Header
- Add `lastCheckResult` state for displaying status
- Clear status after timeout

## Security Considerations

1. **Password Security:**
   - Password retrieved from Vault only in Edge Function
   - Never exposed to frontend or API routes
   - Connection uses TLS by default

2. **Rate Limiting:**
   - Prevent abuse of "Check Now" button
   - Max 1 import per 10 seconds per user
   - Track in-memory or Redis (for multi-instance)

3. **Email Content:**
   - Sanitize HTML before processing with Readability
   - Remove tracking pixels and external resources
   - Validate messageId format to prevent injection

4. **Database:**
   - Use parameterized queries
   - RLS policies ensure user can only access own signals
   - Transaction rollback on batch failure

## Testing Strategy

### Unit Tests

- Email parsing (plain text, HTML, multipart)
- Readability content extraction
- Duplicate detection logic
- Error handling for malformed emails

### Integration Tests

- IMAP connection with test account
- Vault password retrieval
- Signal record creation
- Email marking as SEEN

### E2E Tests

- User clicks "Check Now"
- Emails imported successfully
- Duplicates skipped
- Status displayed correctly
- Error handling for connection failures

## Success Criteria

- ✅ User can trigger email import with "Check Now" button
- ✅ Emails fetched from IMAP server within 10 seconds
- ✅ Content extracted cleanly using Readability
- ✅ Signals created with status='pending' for AI processing
- ✅ Duplicates skipped (no re-import of same email)
- ✅ Errors handled gracefully with user-friendly messages
- ✅ Failed emails remain UNSEEN for retry
- ✅ Button shows accurate import status

## Future Enhancements

- **Scheduled Imports:** pg_cron job to run every 6 hours
- **Smart Filtering:** Only import from known newsletter domains
- **Folder Support:** Import from specific folders (not just INBOX)
- **Attachment Handling:** Extract and store PDFs, documents
- **Incremental Sync:** Track last sync timestamp
- **Bulk Actions:** "Mark all as read" without importing

## References

- Main Design Doc: `docs/plans/2025-12-30-signal-digest-design.md`
- Email Configuration: `docs/plans/2025-12-30-email-configuration-design.md`
- @mozilla/readability: https://github.com/mozilla/readability
- imapflow: https://imapflow.com/
