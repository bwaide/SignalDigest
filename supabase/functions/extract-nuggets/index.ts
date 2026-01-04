import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface NuggetCandidate {
  title: string
  description: string
  content?: string
  link?: string
  relevancy_score: number
  tags: string[]
}

interface ExtractionResult {
  nuggets: NuggetCandidate[]
  summary?: string
}

async function extractNuggets(rawContent: string, signalTitle: string): Promise<ExtractionResult> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = `You are an AI assistant that extracts key insights (nuggets) from newsletter emails.

Analyze the following email and extract 1-5 key insights or actionable items. Each nugget should be:
- A discrete, standalone piece of information
- Actionable or thought-provoking
- Relevant to someone interested in AI, technology, or innovation

Email Title: ${signalTitle}

Email Content:
${rawContent.substring(0, 8000)} ${rawContent.length > 8000 ? '...(truncated)' : ''}

For each nugget, provide:
1. title (10-60 chars): A compelling headline
2. description (50-200 chars): A brief explanation
3. content (optional): Additional context or details
4. link (optional): URL if mentioned in the email
5. relevancy_score (0-100): How relevant/important this is
6. tags (array): 2-4 relevant tags (e.g., ["AI", "Product Launch", "Research"])

Return your response as JSON in this exact format:
{
  "nuggets": [
    {
      "title": "string",
      "description": "string",
      "content": "string (optional)",
      "link": "string (optional)",
      "relevancy_score": number,
      "tags": ["string", "string"]
    }
  ],
  "summary": "A brief 1-2 sentence summary of the overall email"
}

Return ONLY valid JSON, no markdown formatting or code blocks.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
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
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  // Parse JSON response
  try {
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content)
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`)
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Get authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const signalId = body.signal_id

    if (!signalId) {
      return new Response(
        JSON.stringify({ error: 'signal_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('id, user_id, title, raw_content, source_identifier, received_date')
      .eq('id', signalId)
      .eq('user_id', user.id)
      .single()

    if (signalError || !signal) {
      return new Response(
        JSON.stringify({ error: 'Signal not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!signal.raw_content) {
      return new Response(
        JSON.stringify({ error: 'Signal has no content to process' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract nuggets using AI
    console.log(`Extracting nuggets from signal ${signalId}`)
    const extraction = await extractNuggets(signal.raw_content, signal.title)

    // Create nuggets in database
    const nuggets = extraction.nuggets.map((nugget) => ({
      user_id: user.id,
      signal_id: signal.id,
      title: nugget.title,
      description: nugget.description,
      content: nugget.content || null,
      link: nugget.link || null,
      source: signal.source_identifier,
      published_date: signal.received_date,
      relevancy_score: nugget.relevancy_score,
      tags: nugget.tags,
      is_read: false,
      is_archived: false,
    }))

    const { data: insertedNuggets, error: insertError } = await supabase
      .from('nuggets')
      .insert(nuggets)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`Failed to insert nuggets: ${insertError.message}`)
    }

    // Update signal status to 'processed'
    const { error: updateError } = await supabase
      .from('signals')
      .update({ status: 'processed' })
      .eq('id', signal.id)

    if (updateError) {
      console.error('Update error:', updateError)
      // Don't throw - nuggets were created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        signal_id: signal.id,
        nuggets_created: insertedNuggets.length,
        nuggets: insertedNuggets,
        summary: extraction.summary,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Extract nuggets error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
