import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SaveConfigRequest {
  host: string
  port: number
  username: string
  password?: string  // Optional - only provided if user wants to update it
  use_tls: boolean
  archive_folder?: string
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

    const body: SaveConfigRequest = await request.json()

    // Validate required fields
    if (!body.host || !body.username) {
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

    const currentSources = currentSettings?.signal_sources || []
    const existingEmailSource = currentSources.find((s: { type: string }) => s.type === 'email')

    let vaultSecretId: string

    // If password provided, store it in Vault
    if (body.password && body.password.trim()) {
      const { data: vaultData, error: vaultError } = await supabase.rpc('create_secret', {
        new_secret: body.password,
        new_name: `email-password-${body.username}-${Date.now()}`,
      })

      if (vaultError) {
        console.error('Vault storage error:', vaultError)
        return NextResponse.json(
          { success: false, error: 'Failed to store password securely' },
          { status: 500 }
        )
      }

      vaultSecretId = vaultData
    } else if (existingEmailSource) {
      // Keep existing vault secret ID
      vaultSecretId = existingEmailSource.config.vault_secret_id
    } else {
      // New config without password - error
      return NextResponse.json(
        { success: false, error: 'Password is required for new configuration' },
        { status: 400 }
      )
    }

    // Create or update signal source object
    const signalSource = {
      id: existingEmailSource?.id || crypto.randomUUID(),
      type: 'email' as const,
      enabled: true,
      config: {
        host: body.host.trim(),
        port: body.port,
        username: body.username.trim(),
        vault_secret_id: vaultSecretId,
        use_tls: body.use_tls,
        archive_folder: body.archive_folder?.trim() || '',
      },
      status: 'connected' as const,
      last_tested_at: new Date().toISOString(),
    }

    // Update or insert signal_sources
    const otherSources = currentSources.filter((s: { type: string }) => s.type !== 'email')
    const updatedSources = [...otherSources, signalSource]

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
