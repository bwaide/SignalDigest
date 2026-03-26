import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

const CODE_EXPIRY_MINUTES = 10
const TOKEN_EXPIRY_DAYS = 30

/**
 * Generate a cryptographically secure random string
 */
function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/**
 * Hash a token with SHA-256 for secure storage.
 * SHA-256 is appropriate (vs bcrypt) because tokens are high-entropy random values.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify PKCE S256 code challenge
 */
export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return hash === codeChallenge
}

/**
 * Register a new OAuth client (Dynamic Client Registration)
 */
export async function createOAuthClient(
  clientName: string | undefined,
  redirectUris: string[]
): Promise<{
  client_id: string
  client_name: string | null
  redirect_uris: string[]
  grant_types: string[]
  token_endpoint_auth_method: string
}> {
  const supabase = createServiceRoleClient()
  const clientId = crypto.randomUUID()

  const { error } = await supabase
    .from('mcp_oauth_clients')
    .insert({
      client_id: clientId,
      client_name: clientName || null,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
    })

  if (error) {
    throw new Error(`Failed to create OAuth client: ${error.message}`)
  }

  return {
    client_id: clientId,
    client_name: clientName || null,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
  }
}

/**
 * Validate that a client_id exists and the redirect_uri matches
 */
export async function validateClient(
  clientId: string,
  redirectUri: string
): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .select('redirect_uris')
    .eq('client_id', clientId)
    .single()

  if (error || !data) return false
  return data.redirect_uris.includes(redirectUri)
}

/**
 * Create an authorization code for a validated user
 */
export async function createAuthorizationCode(
  clientId: string,
  userId: string,
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string = 'S256'
): Promise<string> {
  const supabase = createServiceRoleClient()
  const code = generateSecureToken(32)

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRY_MINUTES)

  const { error } = await supabase
    .from('mcp_oauth_codes')
    .insert({
      code,
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      expires_at: expiresAt.toISOString(),
    })

  if (error) {
    throw new Error(`Failed to create authorization code: ${error.message}`)
  }

  return code
}

/**
 * Exchange an authorization code for an access token.
 * Validates the code, PKCE verifier, client_id, and redirect_uri.
 * Uses atomic update to prevent race conditions on code reuse.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<{
  access_token: string
  token_type: string
  expires_in: number
  scope: string
} | null> {
  const supabase = createServiceRoleClient()

  // Atomically mark code as used and fetch it (prevents TOCTOU race)
  const { data: codeRecord, error } = await supabase
    .from('mcp_oauth_codes')
    .update({ used: true })
    .eq('code', code)
    .eq('client_id', clientId)
    .eq('redirect_uri', redirectUri)
    .eq('used', false)
    .select('*')
    .single()

  if (error || !codeRecord) return null

  // Check expiry
  if (new Date(codeRecord.expires_at) < new Date()) {
    return null
  }

  // Verify PKCE
  if (!verifyPKCE(codeVerifier, codeRecord.code_challenge)) {
    return null
  }

  // Generate access token and store its hash
  const accessToken = generateSecureToken(48)
  const tokenHash = hashToken(accessToken)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)
  const expiresIn = TOKEN_EXPIRY_DAYS * 24 * 60 * 60

  const { error: tokenError } = await supabase
    .from('mcp_oauth_tokens')
    .insert({
      token: tokenHash,
      client_id: clientId,
      user_id: codeRecord.user_id,
      scopes: ['mcp:tools'],
      expires_at: expiresAt.toISOString(),
    })

  if (tokenError) {
    throw new Error(`Failed to create access token: ${tokenError.message}`)
  }

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'mcp:tools',
  }
}

/**
 * Validate an access token and return the associated user ID.
 * Tokens are stored as SHA-256 hashes.
 */
export async function validateAccessToken(
  token: string
): Promise<{ userId: string; scopes: string[] } | null> {
  const supabase = createServiceRoleClient()
  const tokenHash = hashToken(token)

  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('user_id, scopes, expires_at')
    .eq('token', tokenHash)
    .single()

  if (error || !data) return null

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('mcp_oauth_tokens').delete().eq('token', tokenHash)
    return null
  }

  return {
    userId: data.user_id,
    scopes: data.scopes,
  }
}

/**
 * Build the base URL from a request.
 * Uses NEXT_PUBLIC_APP_URL env var if set, otherwise derives from request headers.
 */
export function getBaseUrl(request: Request): string {
  // Prefer explicit config to prevent header injection
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  const url = new URL(request.url)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const protocol = forwardedProto || url.protocol.replace(':', '')
  const host = forwardedHost || url.host
  return `${protocol}://${host}`
}
