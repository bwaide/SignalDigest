import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

    // Parse request body
    const { nugget_id, is_read } = await request.json()

    if (!nugget_id || typeof is_read !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid request: nugget_id and is_read are required' },
        { status: 400 }
      )
    }

    // Update nugget
    const { data, error } = await supabase
      .from('nuggets')
      .update({
        is_read,
        read_at: is_read ? new Date().toISOString() : null,
      })
      .eq('id', nugget_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update nugget' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      nugget: data,
    })
  } catch (error) {
    console.error('Mark read error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
