import { createClient } from 'supabase'
import { ImapFlow } from 'npm:imapflow@1.0.164'
import { Readability } from 'npm:@mozilla/readability@0.5.0'
import { JSDOM } from 'npm:jsdom@23.2.0'
import { classifyEmail } from './email-classifier.ts'

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

interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

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
  headers?: Record<string, string>
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

async function getEmailConfig(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('signal_sources')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch email config: ${error.message}`)
  }

  const emailSource = settings?.signal_sources?.find((s: { type: string }) => s.type === 'email')
  if (!emailSource || emailSource.status !== 'connected') {
    throw new Error('Email source not configured or not connected')
  }

  return emailSource.config
}

async function getPasswordFromVault(supabase: ReturnType<typeof createClient>, vaultSecretId: string): Promise<string> {
  // Use Supabase Vault to retrieve the password
  const { data, error } = await supabase
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', vaultSecretId)
    .single()

  if (error) {
    throw new Error(`Failed to retrieve password from Vault: ${error.message}`)
  }

  if (!data || !data.decrypted_secret) {
    throw new Error('Password not found in Vault')
  }

  return data.decrypted_secret
}

async function fetchUnreadEmails(client: ImapFlow, limit: number = 50): Promise<EmailMessage[]> {
  // Select INBOX
  const mailbox = await client.mailboxOpen('INBOX')
  console.log(`Mailbox opened: ${mailbox.path}, Total messages: ${mailbox.exists}, Unseen: ${mailbox.unseen}`)

  // Search for UNSEEN emails
  const searchResults = await client.search({ seen: false }, { uid: true })
  console.log(`IMAP search returned ${searchResults?.length || 0} unread messages`)

  if (!searchResults || searchResults.length === 0) {
    console.log('No unread messages found in INBOX')
    return []
  }

  // Limit to first 50
  const uids = searchResults.slice(0, limit)
  const emails: EmailMessage[] = []
  let skippedNonNewsletters = 0

  // Fetch email details
  for await (const message of client.fetch(uids, {
    envelope: true,
    bodyStructure: true,
    source: true,
  })) {
    try {
      const email = await parseEmail(message)

      // Classify email as newsletter or not
      const classification = classifyEmail(email)

      if (!classification.isNewsletter) {
        console.log(`Skipping non-newsletter (confidence: ${classification.confidence}%):`, {
          from: email.from,
          subject: email.subject,
          signals: classification.signals,
          reason: classification.reason
        })
        skippedNonNewsletters++
        continue
      }

      console.log(`Accepting newsletter (confidence: ${classification.confidence}%):`, {
        from: email.from,
        subject: email.subject,
        signals: classification.signals
      })

      emails.push(email)
    } catch (error) {
      console.error(`Failed to parse email UID ${message.uid}:`, error)
      // Continue with next email
    }
  }

  console.log(`Fetched ${emails.length} newsletters, skipped ${skippedNonNewsletters} non-newsletters`)
  return emails
}

interface EmailAddress {
  address: string
  name?: string
}

interface BodyNode {
  disposition?: string
}

interface ImapMessage {
  uid: number
  envelope: {
    messageId?: string
    subject?: string
    from?: EmailAddress[]
    to?: EmailAddress[]
    cc?: EmailAddress[]
    date?: Date
  }
  source?: Uint8Array
  bodyStructure?: {
    childNodes?: BodyNode[]
  }
}

async function parseEmail(message: ImapMessage): Promise<EmailMessage> {
  const envelope = message.envelope
  const from = envelope.from?.[0]

  let bodyText = ''
  let bodyHtml = ''
  const headers: Record<string, string> = {}

  if (message.source) {
    const source = new TextDecoder().decode(message.source)

    // Extract headers (everything before first blank line)
    const headerEnd = source.search(/\r?\n\r?\n/)
    if (headerEnd !== -1) {
      const headerSection = source.substring(0, headerEnd)
      const headerLines = headerSection.split(/\r?\n/)

      for (const line of headerLines) {
        const colonIndex = line.indexOf(':')
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim()
          const value = line.substring(colonIndex + 1).trim()
          headers[key] = value
        }
      }
    }

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

  const hasAttachments = message.bodyStructure?.childNodes?.some((n: BodyNode) => n.disposition === 'attachment') || false

  return {
    uid: message.uid,
    messageId: envelope.messageId || `uid-${message.uid}`,
    subject: envelope.subject || '(No Subject)',
    from: from?.address || 'unknown@unknown.com',
    fromName: from?.name,
    to: envelope.to?.map((t: EmailAddress) => t.address),
    cc: envelope.cc?.map((c: EmailAddress) => c.address),
    date: envelope.date || new Date(),
    bodyText,
    bodyHtml,
    hasAttachments,
    headers,
  }
}

async function isDuplicate(supabase: ReturnType<typeof createClient>, userId: string, messageId: string): Promise<boolean> {
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

async function createSignal(supabase: ReturnType<typeof createClient>, userId: string, email: EmailMessage) {
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

async function moveEmailToFolder(
  client: ImapFlow,
  uid: number,
  targetFolder: string
): Promise<void> {
  try {
    // Ensure target folder exists, create if not
    const list = await client.list()
    const folderExists = list.some((mailbox) => mailbox.path === targetFolder)

    if (!folderExists) {
      console.log(`Creating folder: ${targetFolder}`)
      await client.mailboxCreate(targetFolder)
    }

    // Move the message to target folder
    console.log(`Moving UID ${uid} to ${targetFolder}`)
    await client.messageMove(uid, targetFolder, { uid: true })
  } catch (error) {
    console.error(`Failed to move email UID ${uid} to ${targetFolder}:`, error)
    // Don't throw - we don't want to fail the import if archive fails
  }
}

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

    // Create Supabase client with anon key for user JWT validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Use anon key client to validate user JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

    // Get user ID from JWT
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('[EDGE-FUNCTION] Auth failed:', { authError: authError?.message, hasUser: !!user })
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for database operations (to access Vault)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get email config
    const emailConfig = await getEmailConfig(supabase, user.id)

    // Retrieve password from Vault
    const password = await getPasswordFromVault(supabase, emailConfig.vault_secret_id)

    const imapConfig: ImapConfig = {
      host: emailConfig.host,
      port: emailConfig.port,
      username: emailConfig.username,
      password: password,
      use_tls: emailConfig.use_tls,
    }

    // Connect to IMAP
    const client = await connectToImap(imapConfig)

    try {
      // Fetch unread emails
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

          // Move to archive folder if configured
          const archiveFolder = emailConfig.archive_folder
          if (archiveFolder && archiveFolder.trim()) {
            console.log(`Moving email to archive folder: ${archiveFolder}`)
            await moveEmailToFolder(client, email.uid, archiveFolder.trim())
          }

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
    } finally {
      // Always close the IMAP connection
      try {
        await client.logout()
      } catch (logoutError) {
        // Ignore logout errors (connection may already be closed)
        console.log('IMAP logout error (expected if already closed):', logoutError)
      }
    }
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
