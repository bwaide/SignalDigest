import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

/**
 * POST /api/auto-sync/schedule
 * Create or update a pg_cron job for auto-sync
 */
export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

    const { enabled, interval_minutes } = await request.json()

    // Validate input
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid enabled value' },
        { status: 400 }
      )
    }

    if (typeof interval_minutes !== 'number' || interval_minutes < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid interval value' },
        { status: 400 }
      )
    }

    if (enabled) {
      // Check if job already exists
      const { data: existingJob } = await supabase
        .from('auto_sync_jobs')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (existingJob) {
        // Update existing schedule
        const { data, error } = await supabase.rpc('update_auto_sync_schedule', {
          p_user_id: userId,
          p_interval_minutes: interval_minutes,
        })

        if (error) {
          console.error('Update schedule error:', error)
          return NextResponse.json(
            { success: false, error: 'Failed to update auto-sync schedule' },
            { status: 500 }
          )
        }

        // Update job record
        const { error: updateError } = await supabase
          .from('auto_sync_jobs')
          .update({
            interval_minutes,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Update job record error:', updateError)
        }
      } else {
        // Create new schedule
        const { data, error } = await supabase.rpc('schedule_auto_sync', {
          p_user_id: userId,
          p_interval_minutes: interval_minutes,
        })

        if (error) {
          console.error('Schedule error:', error)
          return NextResponse.json(
            { success: false, error: 'Failed to create auto-sync schedule' },
            { status: 500 }
          )
        }

        // Store job record
        const { error: insertError } = await supabase
          .from('auto_sync_jobs')
          .insert({
            user_id: userId,
            cron_job_id: data,
            interval_minutes,
          })

        if (insertError) {
          console.error('Insert job record error:', insertError)
        }
      }
    } else {
      // Disable auto-sync by unscheduling the job
      const { error } = await supabase.rpc('unschedule_auto_sync', {
        p_user_id: userId,
      })

      if (error) {
        console.error('Unschedule error:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to unschedule auto-sync' },
          { status: 500 }
        )
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
    console.error('Schedule auto-sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
