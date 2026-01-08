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
    const { source_id, status, extraction_strategy_id, display_name } = body

    if (!source_id) {
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: any = {}

    if (status && ['active', 'paused', 'pending', 'rejected'].includes(status)) {
      updates.status = status
    }

    if (extraction_strategy_id) {
      updates.extraction_strategy_id = extraction_strategy_id
    }

    if (display_name) {
      updates.display_name = display_name
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', source_id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error updating source:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Source updated'
    })
  } catch (error) {
    console.error('Update source error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
