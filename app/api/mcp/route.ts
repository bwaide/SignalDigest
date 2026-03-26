import { NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { validateAccessToken, getBaseUrl } from '@/lib/mcp/oauth'
import { createMcpServer } from '@/lib/mcp/server'

/**
 * Extract and validate the Bearer token from the request.
 * Returns the userId if valid, or a 401 Response if not.
 */
async function authenticateRequest(request: Request): Promise<
  { userId: string } | Response
> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    const baseUrl = getBaseUrl(request)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        },
      }
    )
  }

  const result = await validateAccessToken(token)
  if (!result) {
    const baseUrl = getBaseUrl(request)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Invalid or expired token' },
        id: null,
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        },
      }
    )
  }

  return { userId: result.userId }
}

/**
 * POST /api/mcp — Main MCP Streamable HTTP endpoint (stateless mode).
 * Each request creates a fresh MCP server scoped to the authenticated user.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const server = createMcpServer(userId)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    })

    await server.connect(transport)

    const body = await request.json()
    return await transport.handleRequest(request, { parsedBody: body })
  } catch (error) {
    console.error('[MCP] Error handling request:', error)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/mcp — SSE endpoint for stateful sessions.
 * Returns 405 in stateless mode.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed in stateless mode. Use POST.' },
      id: null,
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  )
}

/**
 * DELETE /api/mcp — Session termination.
 * Returns 405 in stateless mode.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed in stateless mode.' },
      id: null,
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  )
}
