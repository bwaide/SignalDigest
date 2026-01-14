import { NextResponse } from 'next/server'
import type { SignalSource, EmailSourceConfig } from '@/types/signal-sources'

/**
 * Auto-Sync Cron Webhook
 *
 * This endpoint is called by pg_cron to trigger scheduled email imports.
 * It authenticates using a simple API key (not the service role key).
 *
 * Security:
 * - API key is stored in environment variable (CRON_API_KEY)
 * - Service role key stays in Next.js environment (not in database)
 * - Rate limited to prevent abuse
 */
export async function POST(request: Request) {
  try {
    // Verify cron API key
    const apiKey = request.headers.get('X-Cron-API-Key')
    const expectedApiKey = process.env.CRON_API_KEY

    if (!expectedApiKey) {
      console.error('CRON_API_KEY not configured in environment')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      console.warn('Auto-sync cron request with invalid API key')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      )
    }

    // Check if auto-sync is enabled for this user
    // Use service role client to bypass RLS (no user session in cron context)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('auto_sync_enabled')
      .eq('user_id', user_id)
      .single()

    if (!settings?.auto_sync_enabled) {
      return NextResponse.json({
        success: true,
        message: 'Auto-sync not enabled for this user',
        user_id
      })
    }

    // Import emails directly using the existing import logic
    // This is simpler than calling Edge Functions
    const { connectToImap, fetchUnreadEmails, moveEmailToFolder } = await import('@/lib/email-import')

    // Get user's email sources from user_settings
    const { data: userSettings } = await supabaseAdmin
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', user_id)
      .single()

    if (!userSettings?.signal_sources) {
      return NextResponse.json({
        success: true,
        message: 'No signal sources configured',
        user_id
      })
    }

    const emailSources = (userSettings.signal_sources as SignalSource[]).filter(
      (s) => s.type === 'email' && s.status === 'connected'
    )

    if (emailSources.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No enabled email sources',
        user_id
      })
    }

    let totalImported = 0

    // Import from each email source
    for (const source of emailSources) {
      try {
        const emailConfig = source.config as EmailSourceConfig

        // Get password from Vault
        const { data: vaultData, error: vaultError } = await supabaseAdmin
          .from('decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', emailConfig.vault_secret_id)
          .single()

        if (vaultError || !vaultData?.decrypted_secret) {
          console.error('Vault retrieval error:', vaultError)
          continue
        }

        // Connect to IMAP
        const connection = await connectToImap({
          host: emailConfig.host,
          port: emailConfig.port,
          username: emailConfig.username,
          password: vaultData.decrypted_secret,
          use_tls: emailConfig.use_tls,
        })

        try {
          // Fetch unread emails
          const emails = await fetchUnreadEmails(connection, 50)

          // Save signals to database
          for (const email of emails) {
            try {
              // Check for duplicates
              const { data: existing } = await supabaseAdmin
                .from('signals')
                .select('id')
                .eq('user_id', user_id)
                .eq('metadata->>message_id', email.messageId)
                .limit(1)

              if (existing && existing.length > 0) {
                console.log(`Skipping duplicate email: ${email.subject}`)
                // Mark as SEEN to prevent re-import
                await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })
                continue
              }

              // SOURCE DETECTION: Check if source exists
              const sourceIdentifier = `${email.from}|${email.fromName || email.from.split('@')[0]}`

              const { data: existingSource, error: sourceError } = await supabaseAdmin
                .from('sources')
                .select('id, status')
                .eq('user_id', user_id)
                .eq('source_type', 'email')
                .eq('identifier', sourceIdentifier)
                .maybeSingle()

              let sourceId: string | null = null
              let shouldProcessSignal = true

              if (!existingSource) {
                // NEW SOURCE: Create as pending (requires user approval)
                console.log(`New source detected: ${email.fromName} (${email.from})`)

                const { data: newSource, error: createError } = await supabaseAdmin
                  .from('sources')
                  .insert({
                    user_id: user_id,
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
                }

                // Skip email - wait for user to accept the source
                console.log(`Source created as pending - skipping email until user approval`)
                continue
              } else {
                sourceId = existingSource.id

                // Update last_signal_at
                await supabaseAdmin
                  .from('sources')
                  .update({ last_signal_at: email.date.toISOString() })
                  .eq('id', sourceId)

                // Handle based on source status
                if (existingSource.status === 'rejected') {
                  console.log(`Skipping email from rejected source: ${email.fromName}`)
                  // Delete email (mark for spam)
                  await connection.messageFlagsAdd(email.uid, ['\\Deleted'], { uid: true })
                  continue
                } else if (existingSource.status === 'pending') {
                  console.log(`Skipping email from pending source (awaiting user approval): ${email.fromName}`)
                  // DO NOT mark as SEEN - leave unread so it can be imported after user accepts the source
                  continue
                } else if (existingSource.status === 'paused') {
                  console.log(`Importing from paused source (no processing): ${email.fromName}`)
                  shouldProcessSignal = false
                }
                // Only status === 'active' proceeds to import
              }

              // Use bodyText if available, fallback to HTML, or skip if both empty
              const content = email.bodyText || email.bodyHtml || ''
              if (!content || content.trim().length === 0) {
                console.error(`Email has no content: ${email.subject}`)
                continue
              }

              // Create signal with source_id
              const { data: insertedSignal, error: insertError } = await supabaseAdmin
                .from('signals')
                .insert({
                  user_id: user_id,
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
                .select('id')
                .single()

              if (!insertError && insertedSignal) {
                totalImported++

                // Mark as SEEN in mailbox (prevents re-import, but email stays in INBOX)
                await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })

                // Trigger nugget extraction only for active sources
                let processingSucceeded = false
                let extractedNuggets = 0

                if (shouldProcessSignal) {
                  try {
                    const processUrl = new URL('/api/signals/process', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
                    const processResponse = await fetch(processUrl.toString(), {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.CRON_API_KEY}`,
                      },
                      body: JSON.stringify({ signal_id: insertedSignal.id }),
                    })

                    if (processResponse.ok) {
                      const processResult = await processResponse.json()
                      processingSucceeded = processResult.success && processResult.processed > 0
                      extractedNuggets = processResult.processed || 0
                      console.log(`Signal ${insertedSignal.id} processing: success=${processResult.success}, processed=${processResult.processed}, failed=${processResult.failed || 0}`)
                    } else {
                      console.error(`Failed to process signal ${insertedSignal.id}:`, await processResponse.text())
                    }
                  } catch (processError) {
                    console.error(`Failed to trigger processing for signal ${insertedSignal.id}:`, processError)
                  }
                } else {
                  // For paused sources, we import but don't process - consider this "succeeded" for archiving
                  processingSucceeded = true
                }

                // Move to archive folder ONLY if processing succeeded AND nuggets were extracted
                // This prevents "losing" emails that failed to process
                const archiveFolder = emailConfig.archive_folder
                if (archiveFolder && archiveFolder.trim()) {
                  if (processingSucceeded && extractedNuggets > 0) {
                    await moveEmailToFolder(connection, email.uid, archiveFolder.trim())
                    console.log(`Archived email UID ${email.uid} after extracting ${extractedNuggets} nugget(s)`)
                  } else if (!shouldProcessSignal) {
                    // Paused sources: archive without processing
                    await moveEmailToFolder(connection, email.uid, archiveFolder.trim())
                    console.log(`Archived email UID ${email.uid} (paused source, no processing)`)
                  } else {
                    console.warn(`NOT archiving email UID ${email.uid} - processing succeeded: ${processingSucceeded}, nuggets: ${extractedNuggets}. Email will remain in INBOX for inspection.`)
                  }
                }
              } else {
                console.error(`Failed to insert signal:`, insertError)
              }
            } catch (err) {
              console.error('Failed to process email:', err)
            }
          }
        } finally {
          // Always close the IMAP connection
          try {
            await connection.logout()
          } catch {
            // Ignore logout errors
          }
        }
      } catch (error) {
        console.error(`Failed to import from source:`, error)
      }
    }

    console.log(`Auto-sync completed for user ${user_id}: imported ${totalImported} emails`)

    // Get pending sources count for notification badge
    const { count: pendingCount } = await supabaseAdmin
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('status', 'pending')

    return NextResponse.json({
      success: true,
      user_id,
      imported: totalImported,
      pending_sources_count: pendingCount || 0
    })
  } catch (error) {
    console.error('Auto-sync cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
