import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
