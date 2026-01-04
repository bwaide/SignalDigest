import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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

    // Parse request body
    const body = await request.json()
    const { signal_id } = body

    if (!signal_id) {
      return NextResponse.json(
        { success: false, error: 'Missing signal_id' },
        { status: 400 }
      )
    }

    // Verify signal belongs to user
    const { data: signal, error: fetchError } = await supabase
      .from('signals')
      .select('id')
      .eq('id', signal_id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !signal) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 }
      )
    }

    // Delete associated nuggets first (cascading delete should handle this, but being explicit)
    const { error: nuggetsError } = await supabase
      .from('nuggets')
      .delete()
      .eq('signal_id', signal_id)

    if (nuggetsError) {
      console.error('Error deleting nuggets:', nuggetsError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete nuggets' },
        { status: 500 }
      )
    }

    // Delete the signal
    const { error: deleteError } = await supabase
      .from('signals')
      .delete()
      .eq('id', signal_id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting signal:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete signal' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Signal and associated nuggets deleted',
    })
  } catch (error) {
    console.error('Delete signal error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
