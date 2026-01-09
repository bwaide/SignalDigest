import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'
import { generateApiKey, hashApiKey } from '@/lib/auth/api-key'

/**
 * GET /api/settings/api-key
 * Check if the user has an API key configured
 */
export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_settings')
      .select('api_key_hash')
      .eq('user_id', auth.userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('[API Key] Error fetching settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch API key status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hasApiKey: !!data?.api_key_hash,
    })
  } catch (error) {
    console.error('[API Key] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/api-key
 * Generate a new API key (invalidates any existing key)
 */
export async function POST() {
  try {
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const supabase = await createClient()

    // Generate new key
    const apiKey = generateApiKey()
    const apiKeyHash = await hashApiKey(apiKey)

    // Update or insert user settings with the new key hash
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: auth.userId,
          api_key_hash: apiKeyHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[API Key] Error saving key hash:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to generate API key' },
        { status: 500 }
      )
    }

    // Return the plaintext key (only time it's ever shown)
    return NextResponse.json({
      success: true,
      apiKey,
      message: 'API key generated. This is the only time the key will be shown.',
    })
  } catch (error) {
    console.error('[API Key] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/api-key
 * Revoke the current API key
 */
export async function DELETE() {
  try {
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const supabase = await createClient()

    const { error } = await supabase
      .from('user_settings')
      .update({
        api_key_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId)

    if (error) {
      console.error('[API Key] Error revoking key:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked',
    })
  } catch (error) {
    console.error('[API Key] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
