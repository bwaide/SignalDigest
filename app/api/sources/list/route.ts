import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function GET(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const { searchParams } = new URL(request.url)

    // Get query parameters
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const offset = (page - 1) * limit

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('sources')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('last_signal_at', { ascending: false, nullsFirst: false })

    // Filter by status if provided
    if (status && ['pending', 'active', 'paused', 'rejected'].includes(status)) {
      query = query.eq('status', status)
    } else if (!status) {
      // When no status filter is provided (showing "all"), exclude rejected sources
      query = query.neq('status', 'rejected')
    }

    // Execute with pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching sources:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sources: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('List sources error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
