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
    } else {
      // Regular user authentication
      const auth = await authenticateRequest()
      if (auth.error) return auth.error
      userId = auth.userId
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

    const supabase = await createClient()

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
      return NextResponse.json({
        success: true,
        processed: 0,
        message: signalId ? 'Signal not found or already processed' : 'No pending signals to process',
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
        const { data: fullSignal } = await supabase
          .from('signals')
          .select('*, sources!inner(extraction_strategy_id)')
          .eq('id', signal.id)
          .single()

        if (!fullSignal || !fullSignal.raw_content) {
          throw new Error('Signal has no content')
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

        console.log(`Using extraction strategy: ${strategy.name} (${strategy.id}) for signal: ${fullSignal.title}`)

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
          await response.text()
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          throw new Error('No content in OpenAI response')
        }

        // Parse JSON response
        let extraction: { nuggets: Array<{ title: string; content: string; url: string | null; topics: string[]; relevancy_score: number }> }
        try {
          extraction = JSON.parse(content)
        } catch {
          console.error('Failed to parse OpenAI response:', content)
          throw new Error('Failed to parse AI response as JSON')
        }

        // Validate extraction has nuggets
        if (!extraction.nuggets || !Array.isArray(extraction.nuggets)) {
          throw new Error('Invalid extraction format: missing nuggets array')
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

        console.log(`Created ${nuggets.length} nugget(s) for signal: ${signal.title}`)
        processed++
      } catch (error: unknown) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          signal_id: signal.id,
          title: signal.title,
          error: errorMessage,
        })
        console.error(`Failed to process signal "${signal.title}":`, error)
      }
    }

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
