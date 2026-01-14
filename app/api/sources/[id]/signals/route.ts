import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: sourceId } = await params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Verify source belongs to user
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('id', sourceId)
      .eq('user_id', user.id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      )
    }

    // Get signals with nugget count
    const { data: signals, error: signalsError } = await supabase
      .from('signals')
      .select(`
        id,
        title,
        received_date,
        status,
        error_message,
        nuggets(count)
      `)
      .eq('source_id', sourceId)
      .eq('user_id', user.id)
      .order('received_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (signalsError) {
      console.error('Failed to fetch signals:', signalsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch signals' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count: total } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('user_id', user.id)

    // Transform the response to flatten nugget count
    const transformedSignals = (signals || []).map((signal) => ({
      id: signal.id,
      title: signal.title,
      received_date: signal.received_date,
      status: signal.status,
      error_message: signal.error_message,
      nugget_count: Array.isArray(signal.nuggets)
        ? signal.nuggets[0]?.count || 0
        : 0,
    }))

    return NextResponse.json({
      success: true,
      signals: transformedSignals,
      total: total || 0,
      hasMore: offset + limit < (total || 0),
    })
  } catch (error) {
    console.error('Get source signals error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
