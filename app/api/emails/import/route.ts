import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SignalSource } from '@/types/signal-sources'
import { connectToImap, fetchUnreadEmails, moveEmailToFolder } from '@/lib/email-import'
import { authenticateRequest } from '@/lib/auth/server-auth'
import { rateLimiters } from '@/lib/simple-rate-limit'

const DEV_MODE = process.env.NODE_ENV === 'development'

export async function POST() {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId

    // Rate limit email imports to prevent IMAP abuse
    const rateLimit = rateLimiters.emailImport(userId)
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before importing again.',
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          reset: rateLimit.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toISOString(),
          },
        }
      )
    }

    const supabase = await createClient()
    const serviceRoleClient = createServiceRoleClient()

    // Get email configuration
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    const emailSource = settings?.signal_sources?.find((s: SignalSource) => s.type === 'email')
    if (!emailSource || emailSource.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: 'Email not configured' },
        { status: 400 }
      )
    }

    // In dev mode, run import logic directly in API route
    // (Edge Function has auth issues with local `supabase functions serve`)
    if (DEV_MODE) {
      console.log('DEV MODE: Running import logic directly in API route')

      try {
        // Get password from Vault
        const { data: vaultData, error: vaultError } = await supabase
          .from('decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', emailSource.config.vault_secret_id)
          .single()

        if (vaultError || !vaultData?.decrypted_secret) {
          console.error('Vault retrieval error:', vaultError)
          return NextResponse.json(
            { success: false, error: 'Failed to retrieve password from Vault' },
            { status: 500 }
          )
        }

        // Connect to IMAP
        const client = await connectToImap({
          host: emailSource.config.host,
          port: emailSource.config.port,
          username: emailSource.config.username,
          password: vaultData.decrypted_secret,
          use_tls: emailSource.config.use_tls,
        })

        try {
          // Fetch unread emails with sender history for better classification
          const emails = await fetchUnreadEmails(client, 50, supabase, userId)
          console.log(`Found ${emails.length} unread emails`)

          let imported = 0
          let skipped = 0
          let failed = 0
          const errors: Array<{ subject: string; from: string; error: string }> = []

          for (const email of emails) {
            try {
              console.log(`Processing email: ${email.subject} (messageId: ${email.messageId})`)

              // Check for duplicates
              const { data: existing } = await supabase
                .from('signals')
                .select('id')
                .eq('user_id', userId)
                .eq('metadata->>message_id', email.messageId)
                .limit(1)

              if (existing && existing.length > 0) {
                console.log(`Skipping duplicate email: ${email.subject}`)
                skipped++
                continue
              }

              console.log(`Inserting new signal for: ${email.subject}`)

              // Create signal
              const { error: insertError } = await supabase
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

              if (insertError) {
                console.error(`Insert error for ${email.subject}:`, insertError)
                throw insertError
              }

              console.log(`Successfully inserted signal, marking as SEEN`)

              // Mark as SEEN in mailbox
              await client.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })

              // Move to archive folder if configured
              const archiveFolder = emailSource.config.archive_folder
              if (archiveFolder && archiveFolder.trim()) {
                console.log(`Moving email to archive folder: ${archiveFolder}`)
                await moveEmailToFolder(client, email.uid, archiveFolder.trim())
              }

              imported++
              console.log(`Import count: ${imported}`)
            } catch (error: unknown) {
              failed++
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              errors.push({
                subject: email.subject,
                from: email.from,
                error: errorMessage,
              })
              console.error(`Failed to import email "${email.subject}":`, error)
            }
          }

          return NextResponse.json({
            success: failed === 0,
            imported,
            skipped,
            failed,
            hasMore: emails.length === 50,
            errors: errors.length > 0 ? errors : undefined,
          })
        } finally {
          // Always close the IMAP connection
          try {
            await client.logout()
          } catch {
            // Ignore logout errors (connection may already be closed)
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Import error:', error)
        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 500 }
        )
      }
    }

    // Production: Invoke Edge Function
    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No authentication token available' },
        { status: 401 }
      )
    }

    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-emails`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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
