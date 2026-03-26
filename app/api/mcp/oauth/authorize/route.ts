import { NextRequest, NextResponse } from 'next/server'
import { validateClient, createAuthorizationCode, getBaseUrl } from '@/lib/mcp/oauth'
import { createClient } from '@/lib/supabase/server'

/**
 * GET: Check if user is logged in via Supabase session.
 * If yes → show consent page. If no → redirect to login.
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

  // Check if user is already logged in via Supabase session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in — redirect to login page with returnTo back to this authorize URL
    const baseUrl = getBaseUrl(request)
    const returnTo = `/api/mcp/oauth/authorize?${searchParams.toString()}`
    const loginUrl = `${baseUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    return NextResponse.redirect(loginUrl, 302)
  }

  const baseUrl = getBaseUrl(request)

  // User is logged in — show consent page
  const html = renderConsentPage(
    baseUrl,
    user.email || user.id,
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod || 'S256'
  )

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

/**
 * POST: User clicked "Authorize" on the consent page.
 * Verifies session, creates auth code, redirects to Claude's callback.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const clientId = formData.get('client_id') as string
  const redirectUri = formData.get('redirect_uri') as string
  const state = formData.get('state') as string | null
  const codeChallenge = formData.get('code_challenge') as string
  const codeChallengeMethod = formData.get('code_challenge_method') as string

  if (!clientId || !redirectUri || !codeChallenge) {
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

  // Verify user is still logged in via Supabase session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse(renderErrorPage('Session expired. Please log in again.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    // Create authorization code using the session user's ID
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

function renderConsentPage(
  baseUrl: string,
  userEmail: string,
  clientId: string,
  redirectUri: string,
  state: string | null,
  codeChallenge: string,
  codeChallengeMethod: string,
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
    .subtitle { font-size: 0.875rem; color: #a3a3a3; margin-bottom: 1.5rem; line-height: 1.5; }
    .user-info {
      background: #0a0a0a;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.8125rem;
    }
    .user-label { color: #737373; margin-bottom: 0.25rem; }
    .user-email { color: #e5e5e5; font-weight: 500; }
    .permissions {
      margin-bottom: 1.5rem;
      font-size: 0.8125rem;
    }
    .permissions-title { color: #d4d4d4; margin-bottom: 0.5rem; font-weight: 500; }
    .permissions ul { list-style: none; padding: 0; }
    .permissions li {
      padding: 0.375rem 0;
      color: #a3a3a3;
    }
    .permissions li::before {
      content: "\\2713  ";
      color: #22c55e;
    }
    .buttons { display: flex; gap: 0.75rem; }
    .btn {
      flex: 1;
      padding: 0.625rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-align: center;
      text-decoration: none;
    }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: #262626; color: #a3a3a3; }
    .btn-secondary:hover { background: #333; color: #e5e5e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Signal Digest</h1>
    <p class="subtitle">An application is requesting access to your news digest via MCP.</p>
    <div class="user-info">
      <div class="user-label">Signed in as</div>
      <div class="user-email">${escapeHtml(userEmail)}</div>
    </div>
    <div class="permissions">
      <div class="permissions-title">This will allow access to:</div>
      <ul>
        <li>Read your news nuggets and topics</li>
        <li>Search your digest</li>
        <li>View processing status</li>
      </ul>
    </div>
    <form method="POST" action="${escapeHtml(baseUrl)}/api/mcp/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      ${state ? `<input type="hidden" name="state" value="${escapeHtml(state)}">` : ''}
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
      <div class="buttons">
        <a href="${escapeHtml(redirectUri)}?error=access_denied" class="btn btn-secondary">Deny</a>
        <button type="submit" class="btn btn-primary">Authorize</button>
      </div>
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
