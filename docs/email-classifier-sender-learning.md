# Email Classifier - Sender Learning

## Overview

The email classifier now "learns" from previously successful newsletter imports. When classifying an email, it checks if the sender has successfully sent newsletters before, treating them as a trusted newsletter source.

## How It Works

### Sender Signal Enhancement

The `checkSenderSignal()` function now:

1. **Checks Database History** (new!)
   - Queries the `signals` table for processed signals from the same sender
   - If found, immediately returns `sender: true`
   - This happens before pattern matching

2. **Falls Back to Pattern Matching**
   - If no history found or database check fails, uses original logic:
   - Known newsletter platforms (Substack, Beehiiv, Every.to, etc.)
   - Newsletter email patterns (newsletter@, hello@, etc.)
   - Excludes personal/transactional patterns

### Database Query

```typescript
const { data } = await supabase
  .from('signals')
  .select('id')
  .eq('user_id', email.userId)
  .eq('sender_email', email.from)
  .eq('status', 'processed')
  .limit(1)

// If found, sender is trusted
if (data && data.length > 0) {
  return true
}
```

## Benefits

1. **Self-Learning**: Classifier improves over time as you process more newsletters
2. **Reduced False Negatives**: Previously successful senders are always recognized
3. **User-Specific**: Each user's classifier learns from their own email patterns
4. **Fail-Safe**: Falls back to pattern matching if database check fails

## Example

### Before Enhancement

```
Email: superhuman@mail.joinsuperhuman.ai
Signals: sender=false, structure=true, headers=false (1/3)
Result: Skipped as non-newsletter
```

### After Enhancement

```
Email: superhuman@mail.joinsuperhuman.ai
Database check: Found 3 processed signals from this sender
Signals: sender=true, structure=true, headers=false (2/3)
Result: Accepted as newsletter ✓
```

## Implementation Details

### Modified Files

1. **[lib/email-classifier.ts](../lib/email-classifier.ts)**
   - Added `SupabaseClient` import
   - Made `checkSenderSignal()` async with database lookup
   - Made `classifyEmail()` and `isNewsletter()` async
   - Added `userId` to `EmailMessage` interface

2. **[lib/email-import.ts](../lib/email-import.ts)**
   - Updated `fetchUnreadEmails()` to accept `supabase` and `userId`
   - Passes both to `classifyEmail()` for each email

3. **[app/api/emails/import/route.ts](../app/api/emails/import/route.ts)**
   - Updated `fetchUnreadEmails()` call to pass `supabase` and `userId`

### Additional Platform Patterns

Also added common newsletter platforms to the hardcoded list:
- `every.to` - Every newsletter platform
- `joinsuperhuman.ai` - Superhuman newsletters

## Edge Cases

- **New Users**: First emails still rely on pattern matching
- **Database Errors**: Silently falls back to pattern matching
- **Failed Processing**: Only `status='processed'` signals count as trusted
- **No User ID**: Skips database check, uses patterns only

## Future Enhancements

Potential improvements:
1. Cache sender classifications in memory to reduce database queries
2. Track classification confidence over time per sender
3. Allow users to manually mark senders as newsletter/not-newsletter
4. Implement negative learning (mark senders as definitely not newsletters)
