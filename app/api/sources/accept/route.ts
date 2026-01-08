import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
    const body = await request.json()
    const { source_id, extraction_strategy_id } = body

    if (!source_id) {
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update source status to active
    const updates: any = {
      status: 'active',
      activated_at: new Date().toISOString()
    }

    if (extraction_strategy_id) {
      updates.extraction_strategy_id = extraction_strategy_id
    }

    const { data: source, error: updateError } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', source_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError || !source) {
      console.error('Error updating source:', updateError)
      return NextResponse.json(
        { success: false, error: updateError?.message || 'Source not found' },
        { status: 404 }
      )
    }

    // Get pending signals from this source
    const { data: pendingSignals, error: signalsError } = await supabase
      .from('signals')
      .select('id')
      .eq('source_id', source_id)
      .eq('status', 'pending')

    if (signalsError) {
      console.error('Error fetching pending signals:', signalsError)
    }

    // Process pending signals (trigger nugget extraction)
    let processedCount = 0
    if (pendingSignals && pendingSignals.length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

      for (const signal of pendingSignals) {
        try {
          const response = await fetch(`${siteUrl}/api/signals/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization') || ''
            },
            body: JSON.stringify({ signal_id: signal.id })
          })

          if (response.ok) {
            processedCount++
          }
        } catch (error) {
          console.error(`Failed to process signal ${signal.id}:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Source activated',
      processed_signals: processedCount
    })
  } catch (error) {
    console.error('Accept source error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
