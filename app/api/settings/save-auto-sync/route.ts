import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SaveAutoSyncRequest {
  enabled: boolean
  interval_minutes: number
}

export async function POST(request: Request) {
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
