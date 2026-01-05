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
    const { nugget_id } = body

    if (!nugget_id) {
      return NextResponse.json(
        { success: false, error: 'Missing nugget_id' },
        { status: 400 }
      )
    }

    // Delete the nugget
    const { error: deleteError } = await supabase
      .from('nuggets')
      .delete()
      .eq('id', nugget_id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting nugget:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete nugget' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete nugget error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
