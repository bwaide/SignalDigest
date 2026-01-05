import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

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
