import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function GET() {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

    // Load auto-sync settings
    const { data, error } = await supabase
      .from('user_settings')
      .select('auto_sync_enabled, auto_sync_interval_minutes')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no row exists yet, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          settings: {
            enabled: false,
            interval_minutes: 30,
          },
        })
      }

      console.error('Load error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to load auto-sync settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: {
        enabled: data.auto_sync_enabled ?? false,
        interval_minutes: data.auto_sync_interval_minutes ?? 30,
      },
    })
  } catch (error) {
    console.error('Load auto-sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
