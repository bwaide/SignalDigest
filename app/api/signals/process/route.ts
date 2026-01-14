import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStrategy } from '@/lib/extraction-strategies'
import { authenticateRequest } from '@/lib/auth/server-auth'
import { rateLimiters } from '@/lib/simple-rate-limit'

export async function POST(request: Request) {
  try {
    // Support both user authentication and CRON_API_KEY
    const authHeader = request.headers.get('Authorization')
    const cronApiKey = process.env.CRON_API_KEY
    const isCronRequest = authHeader && cronApiKey && authHeader === `Bearer ${cronApiKey}`

    let userId: string
    let signalId: string | undefined

    if (isCronRequest) {
      // For cron requests, get signal_id from body
      const body = await request.json()
      signalId = body.signal_id

      if (!signalId) {
        return NextResponse.json(
          { success: false, error: 'signal_id is required for cron requests' },
          { status: 400 }
        )
      }

      // Get user_id from the signal (use service role client for cron requests)
      const supabaseAdmin = createServiceRoleClient()
      const { data: signal } = await supabaseAdmin
        .from('signals')
        .select('user_id')
        .eq('id', signalId)
        .single()

      if (!signal) {
        return NextResponse.json(
          { success: false, error: 'Signal not found' },
          { status: 404 }
        )
      }

      userId = signal.user_id
      console.log(`[Process] CRON request received for signal ${signalId} (user: ${userId})`)
    } else {
      // Regular user authentication
      const auth = await authenticateRequest()
      if (auth.error) return auth.error
      userId = auth.userId
      console.log(`[Process] User request received (user: ${userId})`)
    }

    // Rate limit signal processing to prevent excessive LLM costs
    const rateLimit = rateLimiters.signalProcess(userId)
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before processing more signals.',
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          reset: rateLimit.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toISOString(),
          },
        }
      )
    }

    // Use service role client for CRON requests (no user session/cookies available)
    // Use regular client for user requests (respects RLS with user session)
    const supabase = isCronRequest ? createServiceRoleClient() : await createClient()

    // Get user's taxonomy topics for extraction
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('taxonomy_topics')
      .eq('user_id', userId)
      .single()

    const taxonomyTopics = userSettings?.taxonomy_topics || [
      'AI & Machine Learning',
      'Social Media & Culture',
      'Business & Finance',
      'Tech Products & Innovation',
      'Climate & Energy',
      'Health & Science',
      'Policy & Regulation',
      'Startups & Funding'
    ]

    // Get pending signals - either specific signal from cron, or all pending
    let query = supabase
      .from('signals')
      .select('id, title')
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (signalId) {
      // Process only the specific signal
      query = query.eq('id', signalId)
    } else {
      // Process all pending signals in order
      query = query.order('received_date', { ascending: false })
    }

    const { data: pendingSignals, error: fetchError } = await query

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pending signals' },
        { status: 500 }
      )
    }

    if (!pendingSignals || pendingSignals.length === 0) {
      const message = signalId
        ? `Signal ${signalId} not found or already processed`
        : 'No pending signals to process'
      console.log(`[Process] ${message} (userId: ${userId}, signalId: ${signalId || 'all'})`)
      return NextResponse.json({
        success: true,
        processed: 0,
        message,
      })
    }

    console.log(`Found ${pendingSignals.length} pending signal(s) to process`)

    // Process each signal
    let processed = 0
    let failed = 0
    const errors: Array<{ signal_id: string; title: string; error: string }> = []

    for (const signal of pendingSignals) {
      try {
        console.log(`Processing signal: ${signal.title}`)

        // Get full signal data with source information
        // Use LEFT JOIN (no !inner) so signals without sources still work
        const { data: fullSignal, error: signalError } = await supabase
          .from('signals')
          .select('*, sources(extraction_strategy_id)')
          .eq('id', signal.id)
          .single()

        if (signalError) {
          console.error(`[Process] Failed to fetch signal ${signal.id}:`, signalError)
          failed++
          errors.push({
            signal_id: signal.id,
            title: signal.title,
            error: `Database error: ${signalError.message}`,
          })
          continue
        }

        if (!fullSignal) {
          console.error(`[Process] Signal ${signal.id} not found in database (may have been deleted)`)
          failed++
          errors.push({
            signal_id: signal.id,
            title: signal.title,
            error: 'Signal not found in database',
          })
          continue
        }

        if (!fullSignal.raw_content || fullSignal.raw_content.trim().length === 0) {
          console.warn(`[Process] Signal ${signal.id} has no content, marking as failed: "${signal.title}"`)
          // Mark signal as failed instead of throwing
          await supabase
            .from('signals')
            .update({
              status: 'failed',
              error_message: 'No content available for extraction'
            })
            .eq('id', signal.id)

          failed++
          errors.push({
            signal_id: signal.id,
            title: signal.title,
            error: 'No content available for extraction',
          })
          continue
        }

        // Extract nuggets using AI Gateway
        const aiGatewayUrl = process.env.AI_GATEWAY_URL
        const aiGatewayKey = process.env.AI_GATEWAY_API_KEY

        if (!aiGatewayUrl || !aiGatewayKey) {
          throw new Error('AI_GATEWAY_URL or AI_GATEWAY_API_KEY not configured')
        }

        // Get source-specific extraction strategy
        const strategyId = fullSignal.sources?.extraction_strategy_id || 'generic'
        const strategy = getStrategy(strategyId)

        // Build prompt using the strategy
        const prompt = strategy.buildPrompt({
          newsletterContent: fullSignal.raw_content,
          userInterests: 'General technology, AI, and business news',
          approvedTopics: taxonomyTopics,
        })

        console.log(`[Process] Using extraction strategy: ${strategy.name} (${strategy.id}) for signal: ${fullSignal.title}`)
        console.log(`[Process] Calling AI Gateway for signal ${signal.id} (content length: ${fullSignal.raw_content.length} chars)`)

        const response = await fetch(`${aiGatewayUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiGatewayKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that extracts key insights from newsletter emails. Always respond with valid JSON only.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[Process] AI Gateway error for signal ${signal.id}: status=${response.status}, body=${errorBody.substring(0, 500)}`)
          throw new Error(`AI Gateway error: ${response.status}`)
        }

        console.log(`[Process] AI Gateway response received for signal ${signal.id}: status=${response.status}`)

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          console.error(`[Process] AI Gateway returned empty content for signal ${signal.id}:`, JSON.stringify(data).substring(0, 500))
          throw new Error('No content in AI Gateway response')
        }

        // Parse JSON response
        let extraction: { nuggets: Array<{ title: string; content: string; url: string | null; topics: string[]; relevancy_score: number }> }
        try {
          extraction = JSON.parse(content)
        } catch {
          console.error(`[Process] Failed to parse AI response as JSON for signal ${signal.id}:`, content.substring(0, 1000))
          throw new Error('Failed to parse AI response as JSON')
        }

        // Validate extraction has nuggets
        if (!extraction.nuggets || !Array.isArray(extraction.nuggets)) {
          console.error(`[Process] Invalid extraction format for signal ${signal.id}: missing nuggets array. Response:`, content.substring(0, 500))
          throw new Error('Invalid extraction format: missing nuggets array')
        }

        console.log(`[Process] AI extracted ${extraction.nuggets.length} nugget(s) from signal ${signal.id}: "${signal.title}"`)

        // Handle case where AI returns empty nuggets array (valid but notable)
        if (extraction.nuggets.length === 0) {
          console.warn(`[Process] AI returned empty nuggets array for signal ${signal.id}: "${signal.title}". This may indicate the content had no extractable insights.`)
        }

        // Create nuggets in database
        const nuggets = extraction.nuggets.map((nugget) => {
          // Use first topic as primary topic, rest as tags
          const primaryTopic = nugget.topics?.[0] || 'Uncategorized'
          const additionalTags = nugget.topics?.slice(1) || []

          return {
            user_id: userId,
            signal_id: signal.id,
            title: nugget.title,
            description: nugget.content,
            content: null,
            link: nugget.url,
            source: fullSignal.source_identifier,
            published_date: fullSignal.received_date,
            relevancy_score: nugget.relevancy_score,
            topic: primaryTopic,
            tags: additionalTags,
            is_read: false,
            is_archived: false,
            is_primary: true,  // Mark as primary (deduplication may change this later)
          }
        })

        const { error: insertError } = await supabase
          .from('nuggets')
          .insert(nuggets)

        if (insertError) {
          throw insertError
        }

        // Update signal status
        await supabase
          .from('signals')
          .update({ status: 'processed' })
          .eq('id', signal.id)

        console.log(`[Process] Successfully created ${nuggets.length} nugget(s) for signal ${signal.id}: "${signal.title}"`)
        processed++
      } catch (error: unknown) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          signal_id: signal.id,
          title: signal.title,
          error: errorMessage,
        })
        console.error(`[Process] Failed to process signal ${signal.id} "${signal.title}":`, error)
      }
    }

    console.log(`[Process] Completed: processed=${processed}, failed=${failed}, total=${pendingSignals.length}`)

    return NextResponse.json({
      success: failed === 0,
      processed,
      failed,
      total: pendingSignals.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Process signals error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
