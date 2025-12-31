import { createClient } from 'supabase'
import { ImapFlow } from 'npm:imapflow@1.0.164'

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

  // Parse body content
  let bodyText = ''
  let bodyHtml = ''

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

    // Connect to IMAP
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
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
