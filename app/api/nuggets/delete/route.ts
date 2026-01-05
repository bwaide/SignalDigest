import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

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
