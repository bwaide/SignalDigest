import { NextRequest, NextResponse } from 'next/server'
import { validateClient, createAuthorizationCode, getBaseUrl } from '@/lib/mcp/oauth'
import { validateApiKey } from '@/lib/auth/api-key'

/**
 * GET: Renders the authorization page where users enter their API key.
 * Claude Desktop opens this in the browser during the OAuth flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const state = searchParams.get('state')
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method')
  const responseType = searchParams.get('response_type')

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge || responseType !== 'code') {
    return new NextResponse(renderErrorPage('Missing required authorization parameters.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return new NextResponse(renderErrorPage('Only S256 code challenge method is supported.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Validate client and redirect_uri
  const isValid = await validateClient(clientId, redirectUri)
  if (!isValid) {
    return new NextResponse(renderErrorPage('Invalid client or redirect URI.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const baseUrl = getBaseUrl(request)

  // Render the login form
  const html = renderLoginPage(baseUrl, clientId, redirectUri, state, codeChallenge, codeChallengeMethod || 'S256')

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

/**
 * POST: Processes the API key form submission.
 * Validates the key, creates an auth code, and redirects back to the client.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const apiKey = formData.get('api_key') as string
  const clientId = formData.get('client_id') as string
  const redirectUri = formData.get('redirect_uri') as string
  const state = formData.get('state') as string | null
  const codeChallenge = formData.get('code_challenge') as string
  const codeChallengeMethod = formData.get('code_challenge_method') as string

  if (!apiKey || !clientId || !redirectUri || !codeChallenge) {
    return new NextResponse(renderErrorPage('Missing required fields.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Validate client and redirect_uri (prevents open redirect / code interception)
  const isValidClient = await validateClient(clientId, redirectUri)
  if (!isValidClient) {
    return new NextResponse(renderErrorPage('Invalid client or redirect URI.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Validate the API key using existing auth infrastructure
  const user = await validateApiKey(`Bearer ${apiKey}`)

  if (!user) {
    const baseUrl = getBaseUrl(request)
    const html = renderLoginPage(
      baseUrl,
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      'Invalid API key. Please check and try again.'
    )
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    // Create authorization code
    const code = await createAuthorizationCode(
      clientId,
      user.id,
      redirectUri,
      codeChallenge,
      codeChallengeMethod || 'S256'
    )

    // Build redirect URL with code and state
    const redirect = new URL(redirectUri)
    redirect.searchParams.set('code', code)
    if (state) {
      redirect.searchParams.set('state', state)
    }

    return NextResponse.redirect(redirect.toString(), 302)
  } catch (error) {
    console.error('[MCP OAuth Authorize] Error creating code:', error)
    return new NextResponse(renderErrorPage('Authorization failed. Please try again.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

function renderLoginPage(
  baseUrl: string,
  clientId: string,
  redirectUri: string,
  state: string | null,
  codeChallenge: string,
  codeChallengeMethod: string,
  errorMessage?: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal Digest — Authorize MCP Access</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #fff; }
    p { font-size: 0.875rem; color: #a3a3a3; margin-bottom: 1.5rem; line-height: 1.5; }
    label { display: block; font-size: 0.8125rem; color: #d4d4d4; margin-bottom: 0.5rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.75rem;
      background: #0a0a0a;
      border: 1px solid #404040;
      border-radius: 8px;
      color: #fff;
      font-size: 0.875rem;
      font-family: 'SF Mono', Monaco, monospace;
      outline: none;
    }
    input[type="password"]:focus { border-color: #3b82f6; }
    button {
      width: 100%;
      padding: 0.625rem;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1rem;
    }
    button:hover { background: #2563eb; }
    .error {
      background: #451a1a;
      border: 1px solid #7f1d1d;
      color: #fca5a5;
      padding: 0.625rem;
      border-radius: 8px;
      font-size: 0.8125rem;
      margin-bottom: 1rem;
    }
    .hint { font-size: 0.75rem; color: #737373; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Signal Digest</h1>
    <p>An application is requesting access to your news digest via MCP. Enter your API key to authorize.</p>
    ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
    <form method="POST" action="${escapeHtml(baseUrl)}/api/mcp/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      ${state ? `<input type="hidden" name="state" value="${escapeHtml(state)}">` : ''}
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
      <label for="api_key">API Key</label>
      <input type="password" id="api_key" name="api_key" placeholder="sd_live_..." required autocomplete="off" autofocus>
      <p class="hint">Find your API key in Signal Digest Settings → API Access.</p>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`
}

function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal Digest — Authorization Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; color: #fca5a5; }
    p { font-size: 0.875rem; color: #a3a3a3; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorization Error</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
