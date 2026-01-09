import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'

interface RelatedSource {
  id: string
  source: string
  title: string
  link: string | null
}

interface NuggetResponse {
  id: string
  title: string
  description: string
  relevancy_score: number
  topic: string | null
  tags: string[]
  source: string
  link: string | null
  published_date: string
  created_at: string
  status: 'unread' | 'saved' | 'archived'
  user_notes: string | null
  related_sources: RelatedSource[]
}

interface ApiResponse {
  nuggets: NuggetResponse[]
  meta: {
    total: number
    returned: number
    filters_applied: {
      status: string | null
      topic: string | null
      min_relevancy: number | null
      since: string | null
      tags: string[] | null
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Validate API key
    const authHeader = request.headers.get('authorization')
    const user = await validateApiKey(authHeader)

    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Invalid or missing API key' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const topicParam = searchParams.get('topic')
    const minRelevancyParam = searchParams.get('min_relevancy')
    const since = searchParams.get('since')
    const tagsParam = searchParams.get('tags')
    const limitParam = searchParams.get('limit')

    // Validate status
    const validStatuses = ['unread', 'saved', 'archived']
    if (statusParam && !validStatuses.includes(statusParam)) {
      return NextResponse.json(
        { error: 'bad_request', message: `Invalid value for status: must be one of ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate min_relevancy
    let minRelevancy: number | null = null
    if (minRelevancyParam) {
      minRelevancy = parseInt(minRelevancyParam, 10)
      if (isNaN(minRelevancy) || minRelevancy < 0 || minRelevancy > 100) {
        return NextResponse.json(
          { error: 'bad_request', message: 'Invalid value for min_relevancy: must be 0-100' },
          { status: 400 }
        )
      }
    }

    // Validate and parse limit
    let limit = 100
    if (limitParam) {
      limit = parseInt(limitParam, 10)
      if (isNaN(limit) || limit < 1) {
        return NextResponse.json(
          { error: 'bad_request', message: 'Invalid value for limit: must be a positive integer' },
          { status: 400 }
        )
      }
      limit = Math.min(limit, 500) // Cap at 500
    }

    // Parse tags
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : null

    // Validate since date
    if (since) {
      const sinceDate = new Date(since)
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { error: 'bad_request', message: 'Invalid value for since: must be a valid ISO datetime' },
          { status: 400 }
        )
      }
    }

    // 3. Build query for primary nuggets
    const supabase = createServiceRoleClient()
    let query = supabase
      .from('nuggets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by status (default: exclude archived)
    if (statusParam) {
      query = query.eq('status', statusParam)
    } else {
      // By default, exclude archived nuggets
      query = query.neq('status', 'archived')
    }
    if (topicParam) {
      query = query.eq('topic', topicParam)
    }
    if (minRelevancy !== null) {
      query = query.gte('relevancy_score', minRelevancy)
    }
    if (since) {
      query = query.gte('created_at', since)
    }
    if (tags?.length) {
      query = query.overlaps('tags', tags)
    }

    const { data: primaryNuggets, error } = await query

    if (error) {
      console.error('[External API] Query error:', error)
      return NextResponse.json(
        { error: 'internal_error', message: 'Failed to fetch nuggets' },
        { status: 500 }
      )
    }

    // 4. Fetch related sources for nuggets with duplicate groups
    const duplicateGroupIds = primaryNuggets
      ?.filter(n => n.duplicate_group_id)
      .map(n => n.duplicate_group_id) || []

    const relatedSourcesMap: Map<string, RelatedSource[]> = new Map()

    if (duplicateGroupIds.length > 0) {
      const { data: relatedNuggets } = await supabase
        .from('nuggets')
        .select('id, source, title, link, duplicate_group_id')
        .in('duplicate_group_id', duplicateGroupIds)
        .eq('is_primary', false)

      if (relatedNuggets) {
        for (const related of relatedNuggets) {
          if (related.duplicate_group_id) {
            const existing = relatedSourcesMap.get(related.duplicate_group_id) || []
            existing.push({
              id: related.id,
              source: related.source,
              title: related.title,
              link: related.link,
            })
            relatedSourcesMap.set(related.duplicate_group_id, existing)
          }
        }
      }
    }

    // 5. Build response
    const nuggets: NuggetResponse[] = (primaryNuggets || []).map(nugget => ({
      id: nugget.id,
      title: nugget.title,
      description: nugget.description,
      relevancy_score: nugget.relevancy_score,
      topic: nugget.topic,
      tags: nugget.tags,
      source: nugget.source,
      link: nugget.link,
      published_date: nugget.published_date,
      created_at: nugget.created_at,
      status: nugget.status,
      user_notes: nugget.user_notes,
      related_sources: nugget.duplicate_group_id
        ? relatedSourcesMap.get(nugget.duplicate_group_id) || []
        : [],
    }))

    const response: ApiResponse = {
      nuggets,
      meta: {
        total: nuggets.length,
        returned: nuggets.length,
        filters_applied: {
          status: statusParam,
          topic: topicParam,
          min_relevancy: minRelevancy,
          since: since,
          tags: tags,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[External API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'internal_error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
