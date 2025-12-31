import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SaveConfigRequest {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // TODO: Remove DEV_MODE bypass before production deployment
    const DEV_MODE = process.env.NODE_ENV === 'development'

    if (!DEV_MODE && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For dev mode without auth, use a mock user ID
    const userId = user?.id || '00000000-0000-0000-0000-000000000000'

    const body: SaveConfigRequest = await request.json()

    // Validate required fields
    if (!body.host || !body.username || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate port range
    if (body.port < 1 || body.port > 65535) {
      return NextResponse.json(
        { success: false, error: 'Port must be between 1 and 65535' },
        { status: 400 }
      )
    }

    // TODO: In production, get vault_secret_id from test-email-connection response
    // For MVP, use mock vault ID
    const mockVaultSecretId = `mock-vault-${Date.now()}`

    // Create signal source object
    const signalSource = {
      id: crypto.randomUUID(),
      type: 'email' as const,
      enabled: true,
      config: {
        host: body.host.trim(),
        port: body.port,
        username: body.username.trim(),
        vault_secret_id: mockVaultSecretId,
        use_tls: body.use_tls,
      },
      status: 'connected' as const,
      last_tested_at: new Date().toISOString(),
    }

    // Get current user settings
    const { data: currentSettings, error: fetchError } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (user_settings doesn't exist yet)
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch current settings' },
        { status: 500 }
      )
    }

    // Update or insert signal_sources
    const currentSources = currentSettings?.signal_sources || []
    const updatedSources = [...currentSources, signalSource]

    const { error: updateError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        signal_sources: updatedSources,
      })

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to save configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      source_id: signalSource.id,
    })
  } catch (error) {
    console.error('Save config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
