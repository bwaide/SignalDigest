# Email Importing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build email importing system that fetches unread emails via IMAP, extracts content using Readability, and creates Signal records for AI processing

**Architecture:** Supabase Edge Function handles IMAP connection and email parsing, Next.js API route validates and invokes the Edge Function, Frontend "Check Now" button triggers import with visual feedback

**Tech Stack:** Deno (Edge Function), imapflow (IMAP), @mozilla/readability (content extraction), Next.js API Routes, React

---

## Task 1: Create Supabase Edge Function Structure

**Files:**
- Create: `supabase/functions/import-emails/index.ts`
- Create: `supabase/functions/import-emails/deno.json`

**Step 1: Create functions directory**

Run: `mkdir -p supabase/functions/import-emails`

**Step 2: Create deno.json configuration**

Create `supabase/functions/import-emails/deno.json`:
```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2.39.0"
  }
}
```

**Step 3: Create basic Edge Function structure**

Create `supabase/functions/import-emails/index.ts`:
```typescript
import { createClient } from 'supabase'

Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    return new Response(
      JSON.stringify({ message: 'Email import function' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**Step 4: Test Edge Function locally**

Run: `supabase functions serve import-emails`
Expected: Function starts on local port

Run: `curl http://localhost:54321/functions/v1/import-emails`
Expected: `{"message":"Email import function"}`

**Step 5: Commit**

```bash
git add supabase/functions/import-emails/
git commit -m "feat: create import-emails edge function structure"
```

---

## Task 2: Implement IMAP Connection Logic

**Files:**
- Modify: `supabase/functions/import-emails/index.ts`

**Step 1: Add IMAP connection function**

Add to `index.ts`:
```typescript
import { ImapFlow } from 'npm:imapflow@1.0.164'

interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

async function connectToImap(config: ImapConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.use_tls,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false, // Disable logging in production
  })

  await client.connect()
  return client
}
```

**Step 2: Add email config retrieval**

Add to `index.ts`:
```typescript
async function getEmailConfig(supabase: any, userId: string) {
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('signal_sources')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch email config: ${error.message}`)
  }

  const emailSource = settings?.signal_sources?.find((s: any) => s.type === 'email')
  if (!emailSource || emailSource.status !== 'connected') {
    throw new Error('Email source not configured or not connected')
  }

  return emailSource.config
}
```

**Step 3: Update main handler to test connection**

Update `Deno.serve` handler:
```typescript
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user ID from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get email config
    const emailConfig = await getEmailConfig(supabase, user.id)

    // For MVP: password is stored in config (not Vault yet)
    // TODO: Retrieve from Vault using vault_secret_id
    const imapConfig: ImapConfig = {
      host: emailConfig.host,
      port: emailConfig.port,
      username: emailConfig.username,
      password: 'PLACEHOLDER', // Will be from Vault
      use_tls: emailConfig.use_tls,
    }

    // Test connection
    const client = await connectToImap(imapConfig)
    await client.logout()

    return new Response(
      JSON.stringify({ success: true, message: 'IMAP connection successful' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**Step 4: Commit**

```bash
git add supabase/functions/import-emails/index.ts
git commit -m "feat: add IMAP connection logic to edge function"
```

---

## Task 3: Implement Email Fetching

**Files:**
- Modify: `supabase/functions/import-emails/index.ts`

**Step 1: Add email fetching function**

Add to `index.ts`:
```typescript
interface EmailMessage {
  uid: number
  messageId: string
  subject: string
  from: string
  fromName?: string
  to?: string[]
  cc?: string[]
  date: Date
  bodyText: string
  bodyHtml?: string
  hasAttachments: boolean
}

async function fetchUnreadEmails(client: ImapFlow, limit: number = 50): Promise<EmailMessage[]> {
  // Select INBOX
  await client.mailboxOpen('INBOX')

  // Search for UNSEEN emails
  const searchResults = await client.search({ seen: false }, { uid: true })

  if (!searchResults || searchResults.length === 0) {
    return []
  }

  // Limit to first 50
  const uids = searchResults.slice(0, limit)
  const emails: EmailMessage[] = []

  // Fetch email details
  for await (const message of client.fetch(uids, {
    envelope: true,
    bodyStructure: true,
    source: true,
  })) {
    try {
      const email = await parseEmail(message)
      emails.push(email)
    } catch (error) {
      console.error(`Failed to parse email UID ${message.uid}:`, error)
      // Continue with next email
    }
  }

  return emails
}

async function parseEmail(message: any): Promise<EmailMessage> {
  const envelope = message.envelope
  const from = envelope.from?.[0]

  // Parse body content
  let bodyText = ''
  let bodyHtml = ''
  let hasAttachments = false

  // Simple body extraction (will enhance with Readability later)
  if (message.source) {
    const source = new TextDecoder().decode(message.source)

    // Very basic parsing - extract plain text or HTML
    const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|\n\r\n--|\r\n\r\n--)/i)
    const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]*?)(?=\n--|\n\r\n--|\r\n\r\n--)/i)

    bodyText = textMatch ? textMatch[1].trim() : ''
    bodyHtml = htmlMatch ? htmlMatch[1].trim() : ''

    if (!bodyText && bodyHtml) {
      // Fallback: strip HTML tags for now (will use Readability later)
      bodyText = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  return {
    uid: message.uid,
    messageId: envelope.messageId || `uid-${message.uid}`,
    subject: envelope.subject || '(No Subject)',
    from: from?.address || 'unknown@unknown.com',
    fromName: from?.name,
    to: envelope.to?.map((t: any) => t.address),
    cc: envelope.cc?.map((c: any) => c.address),
    date: envelope.date || new Date(),
    bodyText,
    bodyHtml,
    hasAttachments: message.bodyStructure?.childNodes?.some((n: any) => n.disposition === 'attachment') || false,
  }
}
```

**Step 2: Update handler to fetch emails**

Update main handler to call `fetchUnreadEmails`:
```typescript
// After connecting to IMAP
const client = await connectToImap(imapConfig)

try {
  // Fetch unread emails
  const emails = await fetchUnreadEmails(client, 50)

  // Disconnect
  await client.logout()

  return new Response(
    JSON.stringify({
      success: true,
      imported: emails.length,
      emails: emails.map(e => ({
        subject: e.subject,
        from: e.from,
        date: e.date,
      }))
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
} finally {
  await client.logout()
}
```

**Step 3: Commit**

```bash
git add supabase/functions/import-emails/index.ts
git commit -m "feat: implement email fetching from IMAP"
```

---

## Task 4: Add Readability Content Extraction

**Files:**
- Modify: `supabase/functions/import-emails/index.ts`

**Step 1: Add Readability imports and helper**

Add to top of `index.ts`:
```typescript
import { Readability } from 'npm:@mozilla/readability@0.5.0'
import { JSDOM } from 'npm:jsdom@23.2.0'

function extractReadableContent(html: string): string | null {
  try {
    const dom = new JSDOM(html)
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    return article?.textContent || null
  } catch (error) {
    console.error('Readability extraction failed:', error)
    return null
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
```

**Step 2: Update parseEmail to use Readability**

Modify `parseEmail` function:
```typescript
async function parseEmail(message: any): Promise<EmailMessage> {
  const envelope = message.envelope
  const from = envelope.from?.[0]

  let bodyText = ''
  let bodyHtml = ''
  let hasAttachments = false

  if (message.source) {
    const source = new TextDecoder().decode(message.source)

    // Extract text and HTML parts
    const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|\n\r\n--|\r\n\r\n--)/i)
    const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]*?)(?=\n--|\n\r\n--|\r\n\r\n--)/i)

    const rawText = textMatch ? textMatch[1].trim() : ''
    const rawHtml = htmlMatch ? htmlMatch[1].trim() : ''

    // Priority: plain text > Readability extraction > stripped HTML
    if (rawText) {
      bodyText = rawText
      bodyHtml = rawHtml
    } else if (rawHtml) {
      bodyHtml = rawHtml

      // Try Readability extraction
      const readable = extractReadableContent(rawHtml)
      if (readable) {
        bodyText = readable
      } else {
        // Fallback to stripped HTML
        bodyText = stripHtml(rawHtml)
      }
    }
  }

  return {
    uid: message.uid,
    messageId: envelope.messageId || `uid-${message.uid}`,
    subject: envelope.subject || '(No Subject)',
    from: from?.address || 'unknown@unknown.com',
    fromName: from?.name,
    to: envelope.to?.map((t: any) => t.address),
    cc: envelope.cc?.map((c: any) => c.address),
    date: envelope.date || new Date(),
    bodyText,
    bodyHtml,
    hasAttachments: message.bodyStructure?.childNodes?.some((n: any) => n.disposition === 'attachment') || false,
  }
}
```

**Step 3: Commit**

```bash
git add supabase/functions/import-emails/index.ts
git commit -m "feat: add Readability content extraction for HTML emails"
```

---

## Task 5: Implement Database Signal Creation

**Files:**
- Modify: `supabase/functions/import-emails/index.ts`

**Step 1: Add duplicate check function**

Add to `index.ts`:
```typescript
async function isDuplicate(supabase: any, userId: string, messageId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('signals')
    .select('id')
    .eq('user_id', userId)
    .eq('metadata->>message_id', messageId)
    .limit(1)

  if (error) {
    console.error('Duplicate check error:', error)
    return false
  }

  return data && data.length > 0
}
```

**Step 2: Add signal creation function**

Add to `index.ts`:
```typescript
async function createSignal(supabase: any, userId: string, email: EmailMessage) {
  const { error } = await supabase
    .from('signals')
    .insert({
      user_id: userId,
      signal_type: 'email',
      title: email.subject,
      raw_content: email.bodyText,
      source_identifier: email.from,
      source_url: null,
      received_date: email.date.toISOString(),
      status: 'pending',
      metadata: {
        message_id: email.messageId,
        from_name: email.fromName,
        has_attachments: email.hasAttachments,
        to: email.to,
        cc: email.cc,
      },
    })

  if (error) {
    throw new Error(`Failed to create signal: ${error.message}`)
  }
}
```

**Step 3: Update handler to create signals**

Modify main handler:
```typescript
// After fetching emails
const emails = await fetchUnreadEmails(client, 50)

let imported = 0
let skipped = 0
let failed = 0
const errors: Array<{ subject: string; from: string; error: string }> = []

for (const email of emails) {
  try {
    // Check for duplicates
    const duplicate = await isDuplicate(supabase, user.id, email.messageId)
    if (duplicate) {
      skipped++
      continue
    }

    // Create signal
    await createSignal(supabase, user.id, email)

    // Mark as SEEN in mailbox
    await client.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })

    imported++
  } catch (error) {
    failed++
    errors.push({
      subject: email.subject,
      from: email.from,
      error: error.message,
    })
    console.error(`Failed to import email "${email.subject}":`, error)
  }
}

await client.logout()

return new Response(
  JSON.stringify({
    success: failed === 0,
    imported,
    skipped,
    failed,
    hasMore: emails.length === 50,
    errors: errors.length > 0 ? errors : undefined,
  }),
  { headers: { 'Content-Type': 'application/json' } }
)
```

**Step 4: Commit**

```bash
git add supabase/functions/import-emails/index.ts
git commit -m "feat: create signals in database from imported emails"
```

---

## Task 6: Create Next.js API Route

**Files:**
- Create: `app/api/emails/import/route.ts`

**Step 1: Create API route directory**

Run: `mkdir -p app/api/emails/import`

**Step 2: Create API route handler**

Create `app/api/emails/import/route.ts`:
```typescript
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // TODO: Remove DEV_MODE bypass before production deployment
    const DEV_MODE = process.env.NODE_ENV === 'development'

    // In dev mode, use service role client to bypass RLS
    const supabase = DEV_MODE ? createServiceRoleClient() : await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!DEV_MODE && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For dev mode without auth, use a mock user ID
    const userId = user?.id || '00000000-0000-0000-0000-000000000000'

    // Get email configuration
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    const emailSource = settings?.signal_sources?.find((s: any) => s.type === 'email')
    if (!emailSource || emailSource.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: 'Email not configured' },
        { status: 400 }
      )
    }

    // Invoke Edge Function
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-emails`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 3: Test API route locally**

Run: `curl -X POST http://localhost:3000/api/emails/import`
Expected: JSON response with import results

**Step 4: Commit**

```bash
git add app/api/emails/import/route.ts
git commit -m "feat: create Next.js API route for email import"
```

---

## Task 7: Update Header Component with Check Now Button

**Files:**
- Modify: `components/layout/Header.tsx`

**Step 1: Read current Header component**

Run: `cat components/layout/Header.tsx`

**Step 2: Add state and handler for Check Now button**

Update `Header.tsx`:
```typescript
'use client'

import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'
import { useState } from 'react'

interface HeaderProps {
  emailStatus?: SignalSourceStatus
}

export function Header({ emailStatus = 'not_configured' }: HeaderProps) {
  const openSettings = useSettingsStore((state) => state.openSettings)
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const handleCheckNow = async () => {
    if (isChecking) return

    setIsChecking(true)
    setCheckResult(null)

    try {
      const response = await fetch('/api/emails/import', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCheckResult(`✓ Imported ${data.imported} emails`)

        // Reload page after 2 seconds to show new signals
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setCheckResult(`✗ Import failed: ${data.error}`)
      }
    } catch (error) {
      setCheckResult('✗ Network error')
    } finally {
      setIsChecking(false)

      // Clear result after 5 seconds
      setTimeout(() => {
        setCheckResult(null)
      }, 5000)
    }
  }

  const isCheckDisabled = emailStatus !== 'connected' || isChecking

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">Signal Digest</h1>
          <ConnectionStatus status={emailStatus} onClick={openSettings} />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCheckNow}
            disabled={isCheckDisabled}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkResult || (isChecking ? 'Checking...' : '🔄 Check Now')}
          </button>
          <button
            onClick={openSettings}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    </header>
  )
}
```

**Step 3: Test Check Now button**

1. Run: `npm run dev`
2. Open browser to http://localhost:3000
3. Click "Check Now" button
4. Verify loading state and result message

**Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat: add Check Now button with email import functionality"
```

---

## Task 8: Deploy and Test Edge Function

**Step 1: Deploy Edge Function to Supabase**

Run: `supabase functions deploy import-emails`
Expected: Function deployed successfully

**Step 2: Test deployed function**

Run: `supabase functions invoke import-emails --method POST`
Expected: Function executes and returns response

**Step 3: Verify in Supabase Dashboard**

1. Open Supabase Dashboard
2. Go to Edge Functions
3. Verify `import-emails` function is deployed
4. Check logs for any errors

**Step 4: Test end-to-end flow**

1. Configure email in settings
2. Click "Check Now" button
3. Verify emails are imported
4. Check signals table in Supabase for new records

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete email importing implementation"
```

---

## Testing Checklist

- [ ] Edge Function deploys without errors
- [ ] IMAP connection works with configured email
- [ ] Emails fetched from INBOX
- [ ] HTML content extracted with Readability
- [ ] Plain text emails handled correctly
- [ ] Signals created in database with correct data
- [ ] Duplicate emails skipped (messageId check)
- [ ] Emails marked as SEEN after import
- [ ] Check Now button shows loading state
- [ ] Success message displays import count
- [ ] Error handling for connection failures
- [ ] Page reloads to show new signals

---

## Deployment Notes

**Environment Variables Needed:**
- `SUPABASE_URL` - Set in Edge Function
- `SUPABASE_SERVICE_ROLE_KEY` - Set in Edge Function
- `NEXT_PUBLIC_SUPABASE_URL` - Already configured
- `SUPABASE_SERVICE_ROLE_KEY` - Already configured (Next.js)

**Security:**
- Edge Function uses service role key to bypass RLS
- Password should be retrieved from Vault (TODO)
- Rate limiting should be added to API route (TODO)

**Performance:**
- Batch size limited to 50 emails per invocation
- Edge Function timeout is 60 seconds
- Consider adding progress indicators for large imports
