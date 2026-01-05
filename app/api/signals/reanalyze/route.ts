import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getExtractionStrategy, generateExtractionPrompt } from '@/lib/nugget-extraction-strategies'
import { authenticateRequest } from '@/lib/auth/server-auth'

export async function POST(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    const userId = auth.userId
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

    // Parse request body
    const { signal_id } = await request.json()

    if (!signal_id) {
      return NextResponse.json(
        { success: false, error: 'signal_id is required' },
        { status: 400 }
      )
    }

    // Get the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signal_id)
      .eq('user_id', userId)
      .single()

    if (signalError || !signal) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 }
      )
    }

    if (!signal.raw_content) {
      return NextResponse.json(
        { success: false, error: 'Signal has no content to analyze' },
        { status: 400 }
      )
    }

    // Step 1: Delete existing nuggets for this signal
    const { error: deleteError } = await supabase
      .from('nuggets')
      .delete()
      .eq('signal_id', signal_id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete existing nuggets' },
        { status: 500 }
      )
    }

    // Step 2: Extract nuggets using AI Gateway
    const aiGatewayUrl = process.env.AI_GATEWAY_URL
    const aiGatewayKey = process.env.AI_GATEWAY_API_KEY

    if (!aiGatewayUrl || !aiGatewayKey) {
      return NextResponse.json(
        { success: false, error: 'AI_GATEWAY_URL or AI_GATEWAY_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Get source-specific extraction strategy
    const strategy = getExtractionStrategy(signal.source_identifier)
    const prompt = generateExtractionPrompt(
      strategy,
      signal.raw_content,
      signal.title,
      taxonomyTopics
    )

    console.log(`Re-analyzing signal ${signal_id} using strategy: ${strategy.sourceName}`)

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
    let extraction: { nuggets: Array<{ title: string; description: string; content?: string; link?: string; relevancy_score: number; topic: string; tags?: string[] }> }
    try {
      extraction = JSON.parse(content)
    } catch {
      console.error('Failed to parse OpenAI response:', content)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Step 3: Create new nuggets in database
    const nuggets = extraction.nuggets.map((nugget) => ({
      user_id: userId,
      signal_id: signal.id,
      title: nugget.title,
      description: nugget.description,
      content: nugget.content || null,
      link: nugget.link || null,
      source: signal.source_identifier,
      published_date: signal.received_date,
      relevancy_score: nugget.relevancy_score,
      topic: nugget.topic,
      tags: nugget.tags || [],
      is_read: false,
      is_archived: false,
    }))

    const { error: insertError } = await supabase
      .from('nuggets')
      .insert(nuggets)

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    // Step 4: Update signal status to processed
    await supabase
      .from('signals')
      .update({ status: 'processed' })
      .eq('id', signal_id)

    console.log(`Re-analyzed signal ${signal_id}: created ${nuggets.length} nugget(s)`)

    return NextResponse.json({
      success: true,
      nugget_count: nuggets.length,
    })
  } catch (error) {
    console.error('Re-analyze signal error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
