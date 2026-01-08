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

    // Get the source first to check its status
    const { data: source } = await supabase
      .from('sources')
      .select('status')
      .eq('id', source_id)
      .eq('user_id', userId)
      .single()

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      )
    }

    let error

    if (source.status === 'rejected') {
      // Hard delete rejected sources
      // Signals will have source_id set to NULL (ON DELETE SET NULL)
      const result = await supabase
        .from('sources')
        .delete()
        .eq('id', source_id)
        .eq('user_id', userId)
      error = result.error
    } else {
      // Soft delete active/paused sources (reject them)
      const result = await supabase
        .from('sources')
        .update({ status: 'rejected' })
        .eq('id', source_id)
        .eq('user_id', userId)
      error = result.error
    }

    if (error) {
      console.error('Error deleting source:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Source deleted'
    })
  } catch (error) {
    console.error('Delete source error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
