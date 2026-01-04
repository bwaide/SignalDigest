import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { connectToImap } from '@/lib/email-import'

interface TestConnectionRequest {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

export async function POST(request: Request) {
  try {
    const body: TestConnectionRequest = await request.json()

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

    // Test IMAP connection
    try {
      const client = await connectToImap({
        host: body.host,
        port: body.port,
        username: body.username,
        password: body.password,
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

    // Store password in Supabase Vault
    const supabase = createServiceRoleClient()

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

    return NextResponse.json({
      success: true,
      vault_secret_id: vaultData,
    })
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
