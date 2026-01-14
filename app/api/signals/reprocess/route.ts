import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { signal_id } = await request.json()

    if (!signal_id) {
      return NextResponse.json(
        { success: false, error: 'signal_id is required' },
        { status: 400 }
      )
    }

    // Verify signal belongs to user and get current status
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('id, status, title')
      .eq('id', signal_id)
      .eq('user_id', user.id)
      .single()

    if (signalError || !signal) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 }
      )
    }

    // Only allow reprocessing of pending or failed signals
    if (signal.status === 'processed') {
      return NextResponse.json(
        { success: false, error: 'Signal is already processed' },
        { status: 400 }
      )
    }

    // Reset status to pending and clear error message for failed signals
    if (signal.status === 'failed') {
      const { error: updateError } = await supabase
        .from('signals')
        .update({
          status: 'pending',
          error_message: null,
          retry_count: 0,
        })
        .eq('id', signal_id)

      if (updateError) {
        console.error('Failed to reset signal status:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to reset signal status' },
          { status: 500 }
        )
      }
    }

    // Trigger processing via the existing process endpoint
    const processUrl = new URL('/api/signals/process', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

    // Forward the user's cookies for authentication
    const cookieHeader = request.headers.get('cookie')

    const processResponse = await fetch(processUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
      body: JSON.stringify({ signal_id }),
    })

    const processResult = await processResponse.json()

    if (!processResponse.ok) {
      return NextResponse.json(
        { success: false, error: processResult.error || 'Processing failed' },
        { status: processResponse.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Reprocessing started for "${signal.title}"`,
      result: processResult,
    })
  } catch (error) {
    console.error('Reprocess signal error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
