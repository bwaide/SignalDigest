import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'

interface TopicInfo {
  topic: string
  count: number
  unread_count: number
  saved_count: number
}

interface TopicsResponse {
  topics: TopicInfo[]
  meta: {
    total_topics: number
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

    // 2. Get topics with counts
    const supabase = createServiceRoleClient()

    // Get all topics with their counts
    const { data: nuggets, error } = await supabase
      .from('nuggets')
      .select('topic, status')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .not('topic', 'is', null)

    if (error) {
      console.error('[External API] Topics query error:', error)
      return NextResponse.json(
        { error: 'internal_error', message: 'Failed to fetch topics' },
        { status: 500 }
      )
    }

    // Aggregate counts by topic
    const topicMap = new Map<string, { count: number; unread: number; saved: number }>()

    for (const nugget of nuggets || []) {
      const topic = nugget.topic
      if (!topic) continue

      const existing = topicMap.get(topic) || { count: 0, unread: 0, saved: 0 }
      existing.count++
      if (nugget.status === 'unread') existing.unread++
      if (nugget.status === 'saved') existing.saved++
      topicMap.set(topic, existing)
    }

    // Convert to array and sort by count descending
    const topics: TopicInfo[] = Array.from(topicMap.entries())
      .map(([topic, counts]) => ({
        topic,
        count: counts.count,
        unread_count: counts.unread,
        saved_count: counts.saved,
      }))
      .sort((a, b) => b.count - a.count)

    const response: TopicsResponse = {
      topics,
      meta: {
        total_topics: topics.length,
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
