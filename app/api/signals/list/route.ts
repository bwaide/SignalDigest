import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function GET() {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const supabase = await createClient()

    // Fetch signals with nugget count
    const { data: signals, error: fetchError } = await supabase
      .from('signals')
      .select(`
        id,
        title,
        source_identifier,
        received_date,
        status,
        created_at
      `)
      .eq('user_id', userId)
      .order('received_date', { ascending: false })
      .limit(100)

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch signals' },
        { status: 500 }
      )
    }

    // Get nugget counts for each signal
    const signalsWithCounts = await Promise.all(
      (signals || []).map(async (signal) => {
        const { count } = await supabase
          .from('nuggets')
          .select('*', { count: 'exact', head: true })
          .eq('signal_id', signal.id)

        return {
          ...signal,
          nugget_count: count || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      signals: signalsWithCounts,
    })
  } catch (error) {
    console.error('List signals error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
