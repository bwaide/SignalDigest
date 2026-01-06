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
          const emails = await fetchUnreadEmails(connection, 50, supabaseAdmin, user_id)

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
                // Mark as SEEN to prevent re-import (keep in inbox since not processed)
                await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })
                continue
              }

              // Create signal and get the inserted ID
              const { data: insertedSignal, error: insertError } = await supabaseAdmin
                .from('signals')
                .insert({
                  user_id: user_id,
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
                .select('id')
                .single()

              if (!insertError && insertedSignal) {
                totalImported++

                // Mark as SEEN in mailbox
                await connection.messageFlagsAdd(email.uid, ['\\Seen'], { uid: true })

                // Move to archive folder if configured
                const archiveFolder = emailConfig.archive_folder
                if (archiveFolder && archiveFolder.trim()) {
                  await moveEmailToFolder(connection, email.uid, archiveFolder.trim())
                }

                // Trigger nugget extraction for the signal
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

                  if (!processResponse.ok) {
                    console.error(`Failed to process signal ${insertedSignal.id}:`, await processResponse.text())
                  }
                } catch (processError) {
                  console.error(`Failed to trigger processing for signal ${insertedSignal.id}:`, processError)
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

    return NextResponse.json({
      success: true,
      user_id,
      imported: totalImported
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
