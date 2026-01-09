import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SignalSource } from '@/types/signal-sources'
import { connectToImap, fetchUnreadEmails, moveEmailToFolder } from '@/lib/email-import'
import { authenticateRequest } from '@/lib/auth/server-auth'
import { rateLimiters } from '@/lib/simple-rate-limit'

const DEV_MODE = process.env.NODE_ENV === 'development'

export async function POST() {
  console.log('[EMAIL-IMPORT] POST request received')
  try {
    // Authenticate the request
    console.log('[EMAIL-IMPORT] Attempting authentication')
    const auth = await authenticateRequest()
    if (auth.error) {
      console.log('[EMAIL-IMPORT] Authentication failed, returning error')
      return auth.error
    }
    console.log('[EMAIL-IMPORT] Authentication successful, userId:', auth.userId)

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
        // Get password from Vault (requires service role)
        const { data: vaultData, error: vaultError} = await serviceRoleClient
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
          // Fetch unread emails
          const emails = await fetchUnreadEmails(client, 50)
          console.log(`Found ${emails.length} unread emails`)

          let imported = 0
          let skipped = 0
          let failed = 0
          let newPendingSources = 0
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
                // Mark as SEEN to prevent re-import
                await client.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })
                skipped++
                continue
              }

              // SOURCE DETECTION: Check if source exists
              const sourceIdentifier = `${email.from}|${email.fromName || email.from.split('@')[0]}`

              const { data: existingSource, error: sourceError } = await supabase
                .from('sources')
                .select('id, status')
                .eq('user_id', userId)
                .eq('source_type', 'email')
                .eq('identifier', sourceIdentifier)
                .maybeSingle()

              let sourceId: string | null = null
              let shouldProcessSignal = true

              if (!existingSource) {
                // NEW SOURCE: Create as pending (requires user approval)
                console.log(`New source detected: ${email.fromName} (${email.from})`)

                const { data: newSource, error: createError } = await supabase
                  .from('sources')
                  .insert({
                    user_id: userId,
                    source_type: 'email',
                    identifier: sourceIdentifier,
                    display_name: email.fromName || email.from.split('@')[0],
                    status: 'pending',
                    extraction_strategy_id: 'generic',
                    last_signal_at: email.date.toISOString()
                  })
                  .select('id')
                  .single()

                if (createError || !newSource) {
                  console.error('Failed to create source:', createError)
                } else {
                  newPendingSources++
                }

                // Skip email - wait for user to accept the source
                console.log(`Source created as pending - skipping email until user approval`)
                skipped++
                continue
              } else {
                sourceId = existingSource.id

                // Update last_signal_at
                await supabase
                  .from('sources')
                  .update({ last_signal_at: email.date.toISOString() })
                  .eq('id', sourceId)

                // Handle based on source status
                if (existingSource.status === 'rejected') {
                  console.log(`Skipping email from rejected source: ${email.fromName}`)
                  // Delete email (mark for spam)
                  await client.messageFlagsAdd(email.uid, ['\\Deleted'], { uid: true })
                  skipped++
                  continue
                } else if (existingSource.status === 'pending') {
                  console.log(`Skipping email from pending source (awaiting user approval): ${email.fromName}`)
                  // DO NOT mark as SEEN - leave unread so it can be imported after user accepts the source
                  skipped++
                  continue
                } else if (existingSource.status === 'paused') {
                  console.log(`Importing from paused source (no processing): ${email.fromName}`)
                  shouldProcessSignal = false
                }
                // Only status === 'active' proceeds to import
              }

              console.log(`Inserting new signal for: ${email.subject}`)

              // Use bodyText if available, fallback to HTML, or throw if both empty
              const content = email.bodyText || email.bodyHtml || ''
              if (!content || content.trim().length === 0) {
                console.error(`Email has no content: ${email.subject}`)
                console.error(`bodyText length: ${email.bodyText?.length || 0}, bodyHtml length: ${email.bodyHtml?.length || 0}`)
                console.error(`Email headers:`, email.headers)
                skipped++
                continue
              }

              // Create signal with source_id
              const { error: insertError } = await supabase
                .from('signals')
                .insert({
                  user_id: userId,
                  signal_type: 'email',
                  title: email.subject,
                  raw_content: content,
                  source_identifier: email.from,
                  source_id: sourceId,
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
            newPendingSources,
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
    console.log('[EMAIL-IMPORT] Production mode - getting session for Edge Function call')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('[EMAIL-IMPORT] Session retrieval result:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      hasError: !!sessionError,
      errorMessage: sessionError?.message
    })
    const authToken = session?.access_token

    if (!authToken) {
      console.log('[EMAIL-IMPORT] No auth token available, returning 401')
      return NextResponse.json(
        { success: false, error: 'No authentication token available' },
        { status: 401 }
      )
    }
    console.log('[EMAIL-IMPORT] Auth token obtained, calling Edge Function')

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
