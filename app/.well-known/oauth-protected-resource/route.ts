import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/mcp/oauth'

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  return NextResponse.json({
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp:tools'],
    bearer_methods_supported: ['header'],
  })
}
