import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type NuggetStatus = 'unread' | 'archived' | 'saved'

interface UpdateStatusRequest {
  nugget_id: string
  status: NuggetStatus
}

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

    const body: UpdateStatusRequest = await request.json()

    if (!body.nugget_id || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Missing nugget_id or status' },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses: NuggetStatus[] = ['unread', 'archived', 'saved']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be unread, archived, or saved' },
        { status: 400 }
      )
    }

    // Update nugget status
    const { error: updateError } = await supabase
      .from('nuggets')
      .update({ 
        status: body.status,
        // Update legacy fields for backward compatibility
        is_read: body.status !== 'unread',
        is_archived: body.status === 'archived',
      })
      .eq('id', body.nugget_id)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update nugget status' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
