import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'
import { rateLimiters } from '@/lib/simple-rate-limit'

interface SaveAutoSyncRequest {
  enabled: boolean
  interval_minutes: number
}

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId

    // Rate limit auto-sync schedule changes
    const rateLimit = rateLimiters.autoSyncSchedule(userId)
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before updating auto-sync settings again.',
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

    const body: SaveAutoSyncRequest = await request.json()

    // Validate input
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid enabled value' },
        { status: 400 }
      )
    }

    if (typeof body.interval_minutes !== 'number' || body.interval_minutes < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid interval value' },
        { status: 400 }
      )
    }

    // Check if user_settings row exists
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    let updateError

    if (existingSettings) {
      // Update existing row
      const { error } = await supabase
        .from('user_settings')
        .update({
          auto_sync_enabled: body.enabled,
          auto_sync_interval_minutes: body.interval_minutes,
        })
        .eq('user_id', userId)
      updateError = error
    } else {
      // Insert new row with all required fields
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          auto_sync_enabled: body.enabled,
          auto_sync_interval_minutes: body.interval_minutes,
        })
      updateError = error
    }

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to save auto-sync settings' },
        { status: 500 }
      )
    }

    // Manage pg_cron schedule
    if (body.enabled) {
      // Get webhook URL and API key from environment
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/auto-sync`
      const apiKey = process.env.CRON_API_KEY

      if (!process.env.NEXT_PUBLIC_APP_URL || !apiKey) {
        console.error('NEXT_PUBLIC_APP_URL or CRON_API_KEY not configured')
        return NextResponse.json(
          {
            success: false,
            error: 'Server not configured for auto-sync. Please set NEXT_PUBLIC_APP_URL and CRON_API_KEY.'
          },
          { status: 500 }
        )
      }

      // Check if job already exists
      const { data: existingJob } = await supabase
        .from('auto_sync_jobs')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (existingJob) {
        // Update existing schedule
        const { error: scheduleError } = await supabase.rpc('update_auto_sync_schedule', {
          p_user_id: userId,
          p_interval_minutes: body.interval_minutes,
          p_webhook_url: webhookUrl,
          p_api_key: apiKey,
        })

        if (scheduleError) {
          console.error('Update schedule error:', scheduleError)
        }

        // Update job record
        const { error: jobUpdateError } = await supabase
          .from('auto_sync_jobs')
          .update({
            interval_minutes: body.interval_minutes,
            webhook_url: webhookUrl,
            api_key: apiKey,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (jobUpdateError) {
          console.error('Update job record error:', jobUpdateError)
        }
      } else {
        // Create new schedule
        const { data: jobId, error: scheduleError } = await supabase.rpc('schedule_auto_sync', {
          p_user_id: userId,
          p_interval_minutes: body.interval_minutes,
          p_webhook_url: webhookUrl,
          p_api_key: apiKey,
        })

        if (scheduleError) {
          console.error('Schedule error:', scheduleError)
        } else {
          // Store job record
          const { error: insertError } = await supabase
            .from('auto_sync_jobs')
            .insert({
              user_id: userId,
              cron_job_id: jobId,
              interval_minutes: body.interval_minutes,
              webhook_url: webhookUrl,
              api_key: apiKey,
            })

          if (insertError) {
            console.error('Insert job record error:', insertError)
          }
        }
      }
    } else {
      // Disable auto-sync by unscheduling the job
      const { error: unscheduleError } = await supabase.rpc('unschedule_auto_sync', {
        p_user_id: userId,
      })

      if (unscheduleError) {
        console.error('Unschedule error:', unscheduleError)
      }

      // Delete job record
      const { error: deleteError } = await supabase
        .from('auto_sync_jobs')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Delete job record error:', deleteError)
      }
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Save auto-sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
