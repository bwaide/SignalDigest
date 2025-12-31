import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SignalSource } from '@/types/signal-sources'

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

    // Get current user settings
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (user_settings doesn't exist yet)
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    // Find email source
    const signalSources = (settings?.signal_sources as SignalSource[]) || []
    const emailSource = signalSources.find(source => source.type === 'email')

    if (!emailSource) {
      return NextResponse.json({
        success: true,
        config: null,
      })
    }

    // Return config without password (it's in vault)
    return NextResponse.json({
      success: true,
      config: {
        host: emailSource.config.host,
        port: emailSource.config.port,
        username: emailSource.config.username,
        use_tls: emailSource.config.use_tls,
        status: emailSource.status,
      },
    })
  } catch (error) {
    console.error('Get config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
