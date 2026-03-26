import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/mcp/oauth'

export async function POST(request: NextRequest) {
  try {
    // OAuth token endpoint expects application/x-www-form-urlencoded
    const contentType = request.headers.get('content-type') || ''
    let grantType: string | null = null
    let code: string | null = null
    let codeVerifier: string | null = null
    let clientId: string | null = null
    let redirectUri: string | null = null

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      grantType = formData.get('grant_type') as string
      code = formData.get('code') as string
      codeVerifier = formData.get('code_verifier') as string
      clientId = formData.get('client_id') as string
      redirectUri = formData.get('redirect_uri') as string
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      grantType = body.grant_type
      code = body.code
      codeVerifier = body.code_verifier
      clientId = body.client_id
      redirectUri = body.redirect_uri
    } else {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Unsupported content type' },
        { status: 400 }
      )
    }

    if (grantType !== 'authorization_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' },
        { status: 400 }
      )
    }

    if (!code || !codeVerifier || !clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters: code, code_verifier, client_id, redirect_uri' },
        { status: 400 }
      )
    }

    const result = await exchangeCodeForToken(code, codeVerifier, clientId, redirectUri)

    if (!result) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
        { status: 400 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[MCP OAuth Token] Error:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Token exchange failed' },
      { status: 500 }
    )
  }
}
