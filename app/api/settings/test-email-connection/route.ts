import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { connectToImap } from '@/lib/email-import'

interface TestConnectionRequest {
  host: string
  port: number
  username: string
  password?: string
  use_tls: boolean
}

export async function POST(request: Request) {
  try {
    // TODO: Remove DEV_MODE bypass before production deployment
    const DEV_MODE = process.env.NODE_ENV === 'development'
    const supabase = DEV_MODE ? createServiceRoleClient() : await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || (DEV_MODE ? '00000000-0000-0000-0000-000000000000' : null)

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: TestConnectionRequest = await request.json()

    // Validate required fields
    if (!body.host || !body.username) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let passwordToTest = body.password

    // If no password provided, try to retrieve from existing configuration
    if (!passwordToTest) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('signal_sources')
        .eq('user_id', userId)
        .single()

      if (settings?.signal_sources) {
        const signalSources = settings.signal_sources as Array<{
          type: string
          config: { vault_secret_id?: string }
        }>
        const emailSource = signalSources.find(s => s.type === 'email')

        if (emailSource?.config?.vault_secret_id) {
          const serviceRoleClient = createServiceRoleClient()
          const { data: secretData, error: vaultError } = await serviceRoleClient.rpc(
            'read_secret',
            { secret_id: emailSource.config.vault_secret_id }
          )

          if (!vaultError && secretData) {
            passwordToTest = secretData
          }
        }
      }
    }

    if (!passwordToTest) {
      return NextResponse.json(
        { success: false, error: 'Password is required for testing connection' },
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

    // Test IMAP connection
    try {
      const client = await connectToImap({
        host: body.host,
        port: body.port,
        username: body.username,
        password: passwordToTest,
        use_tls: body.use_tls,
      })
      await client.logout()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        { success: false, error: `IMAP connection failed: ${errorMessage}` },
        { status: 400 }
      )
    }

    // Store password in Supabase Vault only if a new password was provided
    let vaultSecretId: string | undefined

    if (body.password) {
      const serviceRoleClient = createServiceRoleClient()

      const { data: vaultData, error: vaultError } = await serviceRoleClient.rpc('create_secret', {
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
    }

    return NextResponse.json({
      success: true,
      vault_secret_id: vaultSecretId,
    })
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
