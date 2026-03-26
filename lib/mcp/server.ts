import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getNuggets, getTopics, getMorningBriefing, searchNuggets, triggerImport } from './tools'

/**
 * Create an MCP server instance with all tools registered, scoped to a specific user.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'signal-digest',
    version: '1.0.0',
  })

  server.tool(
    'get_nuggets',
    'Retrieve news nuggets with optional filters. Returns AI-extracted information pieces from newsletters with relevancy scores, topics, and tags.',
    {
      topic: z.string().optional().describe('Filter by topic (e.g. "AI & Machine Learning", "Security")'),
      status: z.enum(['unread', 'saved', 'archived']).optional().describe('Filter by status. Defaults to excluding archived.'),
      min_relevancy: z.number().min(0).max(100).optional().describe('Minimum relevancy score (0-100). Higher = more relevant to user interests.'),
      since: z.string().optional().describe('ISO datetime string. Only return nuggets created after this date.'),
      tags: z.array(z.string()).optional().describe('Filter by tags (matches any).'),
      limit: z.number().min(1).max(500).optional().describe('Max results to return (default 50, max 500).'),
    },
    async (params) => {
      try {
        const nuggets = await getNuggets(userId, params)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ nuggets, count: nuggets.length }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error fetching nuggets: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    'get_topics',
    'List all available news topics with counts of total, unread, and saved nuggets.',
    {},
    async () => {
      try {
        const topics = await getTopics(userId)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ topics, total_topics: topics.length }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error fetching topics: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    'get_morning_briefing',
    "Get today's news briefing: high-relevancy nuggets grouped by topic. Perfect for a morning summary of what matters.",
    {
      min_relevancy: z.number().min(0).max(100).optional().describe('Minimum relevancy score (default 70). Lower to see more items.'),
    },
    async (params) => {
      try {
        const briefing = await getMorningBriefing(userId, params.min_relevancy)
        if (briefing.total_nuggets === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No new nuggets found for today (${briefing.date}) with minimum relevancy of ${params.min_relevancy || 70}. Try lowering the min_relevancy threshold or check if emails have been imported today.`,
            }],
          }
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(briefing, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error generating briefing: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    'search_nuggets',
    'Search across all nuggets by text. Searches titles and descriptions. Results sorted by relevancy score.',
    {
      query: z.string().describe('Search text to match against nugget titles and descriptions.'),
      limit: z.number().min(1).max(100).optional().describe('Max results (default 20, max 100).'),
    },
    async (params) => {
      try {
        const results = await searchNuggets(userId, params.query, params.limit)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ results, count: results.length, query: params.query }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching nuggets: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    'trigger_import',
    'Check signal processing status: pending imports, recent processing, and failures. Shows what needs attention.',
    {},
    async () => {
      try {
        const result = await triggerImport(userId)
        return {
          content: [{
            type: 'text' as const,
            text: result,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error triggering import: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        }
      }
    }
  )

  return server
}
