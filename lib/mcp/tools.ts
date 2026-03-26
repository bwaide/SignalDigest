import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Fetch nuggets with filters, scoped to a user.
 */
export async function getNuggets(
  userId: string,
  options: {
    topic?: string
    status?: string
    min_relevancy?: number
    since?: string
    tags?: string[]
    limit?: number
  } = {}
) {
  const supabase = createServiceRoleClient()
  const limit = Math.min(options.limit || 50, 500)

  let query = supabase
    .from('nuggets')
    .select('id, title, description, relevancy_score, topic, tags, source, link, published_date, created_at, status, user_notes, duplicate_group_id, is_primary')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.status) {
    query = query.eq('status', options.status)
  } else {
    query = query.neq('status', 'archived')
  }

  if (options.topic) query = query.eq('topic', options.topic)
  if (options.min_relevancy != null) query = query.gte('relevancy_score', options.min_relevancy)
  if (options.since) query = query.gte('created_at', options.since)
  if (options.tags?.length) query = query.overlaps('tags', options.tags)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch nuggets: ${error.message}`)
  return data || []
}

/**
 * Get topics with counts, scoped to a user.
 */
export async function getTopics(userId: string) {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('nuggets')
    .select('topic, status')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .not('topic', 'is', null)

  if (error) throw new Error(`Failed to fetch topics: ${error.message}`)

  const topicMap = new Map<string, { count: number; unread: number; saved: number }>()
  for (const nugget of data || []) {
    if (!nugget.topic) continue
    const existing = topicMap.get(nugget.topic) || { count: 0, unread: 0, saved: 0 }
    existing.count++
    if (nugget.status === 'unread') existing.unread++
    if (nugget.status === 'saved') existing.saved++
    topicMap.set(nugget.topic, existing)
  }

  return Array.from(topicMap.entries())
    .map(([topic, counts]) => ({ topic, ...counts }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get a morning briefing: today's high-relevancy nuggets grouped by topic.
 */
export async function getMorningBriefing(
  userId: string,
  minRelevancy: number = 70
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nuggets = await getNuggets(userId, {
    min_relevancy: minRelevancy,
    since: today.toISOString(),
    limit: 100,
  })

  // Group by topic
  const byTopic = new Map<string, typeof nuggets>()
  for (const nugget of nuggets) {
    const topic = nugget.topic || 'Other'
    const existing = byTopic.get(topic) || []
    existing.push(nugget)
    byTopic.set(topic, existing)
  }

  return {
    date: today.toISOString().split('T')[0],
    total_nuggets: nuggets.length,
    topics: Array.from(byTopic.entries()).map(([topic, items]) => ({
      topic,
      count: items.length,
      nuggets: items.map(n => ({
        title: n.title,
        description: n.description,
        relevancy_score: n.relevancy_score,
        source: n.source,
        link: n.link,
        tags: n.tags,
      })),
    })),
  }
}

/**
 * Search nuggets by text across title and description.
 */
export async function searchNuggets(
  userId: string,
  query: string,
  limit: number = 20
) {
  const supabase = createServiceRoleClient()

  // Use ilike for text search (Supabase doesn't have full-text search by default on these columns)
  const searchTerm = `%${query}%`

  const { data, error } = await supabase
    .from('nuggets')
    .select('id, title, description, relevancy_score, topic, tags, source, link, published_date, created_at, status')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .order('relevancy_score', { ascending: false })
    .limit(Math.min(limit, 100))

  if (error) throw new Error(`Failed to search nuggets: ${error.message}`)
  return data || []
}

/**
 * Get import/processing status and trigger processing of pending signals.
 * Email fetching requires auto-sync or the web UI; this tool handles the
 * processing pipeline for signals already imported.
 */
export async function triggerImport(userId: string): Promise<string> {
  const supabase = createServiceRoleClient()

  try {
    // Check pending signals
    const { data: pendingSignals, error: pendingError } = await supabase
      .from('signals')
      .select('id, title, source_identifier, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (pendingError) {
      return `Error checking signals: ${pendingError.message}`
    }

    // Check recent processed signals
    const { count: recentProcessed } = await supabase
      .from('signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'processed')
      .gte('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Check recent failed signals
    const { data: failedSignals } = await supabase
      .from('signals')
      .select('id, title, error_message')
      .eq('user_id', userId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)

    const lines: string[] = []
    lines.push(`Signal Processing Status:`)
    lines.push(`- Pending signals: ${pendingSignals?.length || 0}`)
    lines.push(`- Processed in last 24h: ${recentProcessed || 0}`)
    lines.push(`- Recent failures: ${failedSignals?.length || 0}`)

    if (pendingSignals && pendingSignals.length > 0) {
      lines.push(`\nPending signals:`)
      for (const s of pendingSignals.slice(0, 10)) {
        lines.push(`  - "${s.title}" from ${s.source_identifier} (${s.created_at})`)
      }
      lines.push(`\nNote: To process pending signals, use the Signal Digest web UI or enable auto-sync. Email fetching from IMAP is not available via MCP.`)
    }

    if (failedSignals && failedSignals.length > 0) {
      lines.push(`\nRecent failures:`)
      for (const s of failedSignals) {
        lines.push(`  - "${s.title}": ${s.error_message || 'Unknown error'}`)
      }
    }

    if (!pendingSignals?.length && !failedSignals?.length) {
      lines.push(`\nAll signals are processed. Enable auto-sync in settings for automatic email checking.`)
    }

    return lines.join('\n')
  } catch (error) {
    return `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}
