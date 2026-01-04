import { ImapFlow } from 'imapflow'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { classifyEmail } from './email-classifier'

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

export interface EmailMessage {
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

export interface EmailAddress {
  address?: string
  name?: string
}

export interface BodyNode {
  disposition?: string
}

export interface ImapMessage {
  uid: number
  envelope: {
    messageId?: string
    subject?: string
    from?: EmailAddress[]
    to?: EmailAddress[]
    cc?: EmailAddress[]
    date?: Date
  }
  bodyStructure?: {
    childNodes?: BodyNode[]
  }
  source?: Uint8Array
}

export function extractReadableContent(html: string): string | null {
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

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function connectToImap(config: ImapConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.use_tls,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  })

  await client.connect()
  return client
}

export async function moveEmailToFolder(
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

export async function parseEmail(message: ImapMessage): Promise<EmailMessage> {
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

    // Extract boundary from Content-Type header
    const boundaryMatch = source.match(/boundary=([^\s;]+)/i)

    if (boundaryMatch) {
      const boundary = boundaryMatch[1]

      // Match text/plain section: from Content-Type to the boundary
      // Handle both \r\n and \n line endings
      const textPlainRegex = new RegExp(`Content-Type: text/plain[\\s\\S]*?\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n?--${boundary}`, 'i')
      const textMatch = source.match(textPlainRegex)

      // Match text/html section
      const textHtmlRegex = new RegExp(`Content-Type: text/html[\\s\\S]*?\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n?--${boundary}`, 'i')
      const htmlMatch = source.match(textHtmlRegex)

      const rawText = textMatch ? textMatch[1].trim() : ''
      const rawHtml = htmlMatch ? htmlMatch[1].trim() : ''

      if (rawText) {
        bodyText = rawText
        bodyHtml = rawHtml
      } else if (rawHtml) {
        bodyHtml = rawHtml
        const readable = extractReadableContent(rawHtml)
        if (readable) {
          bodyText = readable
        } else {
          bodyText = stripHtml(rawHtml)
        }
      }
    } else {
      // Fallback: no boundary (single-part email)
      // Try to extract text/plain or text/html directly
      const simpleTextMatch = source.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]+)/i)
      const simpleHtmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]+)/i)

      if (simpleTextMatch) {
        bodyText = simpleTextMatch[1].trim()
      } else if (simpleHtmlMatch) {
        bodyHtml = simpleHtmlMatch[1].trim()
        const readable = extractReadableContent(bodyHtml)
        if (readable) {
          bodyText = readable
        } else {
          bodyText = stripHtml(bodyHtml)
        }
      }
    }
  }

  const hasAttachments = message.bodyStructure?.childNodes?.some((n) => n.disposition === 'attachment') || false

  return {
    uid: message.uid,
    messageId: envelope.messageId || `uid-${message.uid}`,
    subject: envelope.subject || '(No Subject)',
    from: from?.address || 'unknown@unknown.com',
    fromName: from?.name,
    to: envelope.to?.map((t) => t.address).filter((a): a is string => a !== undefined),
    cc: envelope.cc?.map((c) => c.address).filter((a): a is string => a !== undefined),
    date: envelope.date || new Date(),
    bodyText,
    bodyHtml,
    hasAttachments,
    headers,
  }
}

export async function fetchUnreadEmails(client: ImapFlow, limit: number = 50): Promise<EmailMessage[]> {
  await client.mailboxOpen('INBOX')
  const searchResults = await client.search({ seen: false }, { uid: true })
  const resultsArray = Array.isArray(searchResults) ? searchResults : []
  console.log(`IMAP search found ${resultsArray.length} unseen messages`)

  if (resultsArray.length === 0) {
    return []
  }

  const uids = resultsArray.slice(0, limit)
  const emails: EmailMessage[] = []
  let skippedNonNewsletters = 0

  console.log(`Fetching ${uids.length} email(s) by UID:`, uids)

  try {
    const fetchResult = client.fetch(uids, {
      envelope: true,
      bodyStructure: true,
      source: true,
    }, { uid: true })

    console.log('Fetch result created, iterating...')

    for await (const message of fetchResult) {
      try {
        console.log(`Parsing email UID ${message.uid}`)
        const email = await parseEmail(message as ImapMessage)
        console.log(`Successfully parsed email: ${email.subject}`)

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
      }
    }
  } catch (error) {
    console.error('Fetch error:', error)
  }

  console.log(`Fetched ${emails.length} newsletters, skipped ${skippedNonNewsletters} non-newsletters`)
  return emails
}
