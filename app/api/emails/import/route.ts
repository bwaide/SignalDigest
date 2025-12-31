import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SignalSource } from '@/types/signal-sources'

export async function POST() {
  try {
    // TODO: Remove DEV_MODE bypass before production deployment
    const DEV_MODE = process.env.NODE_ENV === 'development'

    // In dev mode, use service role client to bypass RLS
    const supabase = DEV_MODE ? createServiceRoleClient() : await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!DEV_MODE && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For dev mode without auth, use a mock user ID
    const userId = user?.id || '00000000-0000-0000-0000-000000000000'

    // Get email configuration
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    const emailSource = settings?.signal_sources?.find((s: SignalSource) => s.type === 'email')
    if (!emailSource || emailSource.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: 'Email not configured' },
        { status: 400 }
      )
    }

    // In dev mode, skip Edge Function and return mock response for now
    // TODO: Fix Edge Function authentication in local development
    if (DEV_MODE) {
      console.log('DEV MODE: Skipping Edge Function call, returning mock response')
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: 0,
        failed: 0,
        hasMore: false,
        message: 'Edge Function integration pending - local dev mode'
      })
    }

    // Production: Invoke Edge Function
    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No authentication token available' },
        { status: 401 }
      )
    }

    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-emails`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    })

    const result = await response.json()

    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
