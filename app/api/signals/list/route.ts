import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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
