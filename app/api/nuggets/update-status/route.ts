import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

type NuggetStatus = 'unread' | 'archived' | 'saved'

interface UpdateStatusRequest {
  nugget_id: string
  status: NuggetStatus
}

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

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
