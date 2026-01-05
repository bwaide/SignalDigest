import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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
