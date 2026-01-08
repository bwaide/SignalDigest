import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const body = await request.json()
    const { source_id } = body

    if (!source_id) {
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update source status to rejected
    const { error: updateError } = await supabase
      .from('sources')
      .update({ status: 'rejected' })
      .eq('id', source_id)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating source:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Delete pending signals from this source
    const { data: deletedSignals, error: deleteError } = await supabase
      .from('signals')
      .delete()
      .eq('source_id', source_id)
      .eq('status', 'pending')
      .select()

    if (deleteError) {
      console.error('Error deleting signals:', deleteError)
    }

    return NextResponse.json({
      success: true,
      message: 'Source rejected',
      deleted_signals: deletedSignals?.length || 0
    })
  } catch (error) {
    console.error('Reject source error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
