import { NextRequest, NextResponse } from 'next/server'
import { createOAuthClient } from '@/lib/mcp/oauth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_name, redirect_uris } = body

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' },
        { status: 400 }
      )
    }

    const client = await createOAuthClient(client_name, redirect_uris)

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('[MCP OAuth Register] Error:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to register client' },
      { status: 500 }
    )
  }
}
