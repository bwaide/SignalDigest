export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Signal Digest External API',
    version: '1.0.0',
    description: `
Read-only REST API for accessing Signal Digest nuggets from external systems.

## Authentication

All endpoints require API key authentication via Bearer token:

\`\`\`
Authorization: Bearer sd_live_<your-api-key>
\`\`\`

Generate your API key in the Signal Digest Settings → API tab.

## Rate Limits

Currently no rate limits are enforced. Please be respectful with request frequency.
    `.trim(),
    contact: {
      name: 'Signal Digest',
    },
  },
  servers: [
    {
      url: '/api/external',
      description: 'External API',
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/nuggets': {
      get: {
        operationId: 'getNuggets',
        summary: 'Get nuggets',
        description: 'Retrieve nuggets with optional filtering by status, topic, relevancy, date range, and tags.',
        tags: ['Nuggets'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filter by nugget status. If not specified, returns unread and saved (excludes archived).',
            required: false,
            schema: {
              type: 'string',
              enum: ['unread', 'saved', 'archived'],
            },
          },
          {
            name: 'topic',
            in: 'query',
            description: 'Filter by topic name (exact match).',
            required: false,
            schema: {
              type: 'string',
            },
            example: 'AI Development',
          },
          {
            name: 'min_relevancy',
            in: 'query',
            description: 'Only return nuggets with relevancy score >= this value.',
            required: false,
            schema: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
            },
            example: 70,
          },
          {
            name: 'since',
            in: 'query',
            description: 'Only return nuggets created after this ISO 8601 timestamp.',
            required: false,
            schema: {
              type: 'string',
              format: 'date-time',
            },
            example: '2025-01-08T00:00:00Z',
          },
          {
            name: 'tags',
            in: 'query',
            description: 'Filter by tags (comma-separated). Returns nuggets that have any of the specified tags.',
            required: false,
            schema: {
              type: 'string',
            },
            example: 'AI,Machine Learning',
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of nuggets to return.',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 500,
              default: 100,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response with nuggets',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NuggetsResponse',
                },
                example: {
                  nuggets: [
                    {
                      id: 'uuid-1',
                      title: 'Anthropic releases Claude 3.5 Opus',
                      description: 'New flagship model with improved reasoning and coding capabilities...',
                      relevancy_score: 95,
                      topic: 'AI Development',
                      tags: ['AI', 'LLM', 'Anthropic'],
                      source: 'The Batch',
                      link: 'https://anthropic.com/news/claude-3-5',
                      published_date: '2025-01-08T10:00:00Z',
                      created_at: '2025-01-08T14:30:00Z',
                      status: 'unread',
                      user_notes: null,
                      related_sources: [
                        {
                          id: 'uuid-2',
                          source: 'AI Weekly',
                          title: 'Claude 3.5 launches with new capabilities',
                          link: 'https://aiweekly.com/claude-3-5',
                        },
                      ],
                    },
                  ],
                  meta: {
                    total: 1,
                    returned: 1,
                    filters_applied: {
                      status: null,
                      topic: 'AI Development',
                      min_relevancy: 70,
                      since: null,
                      tags: null,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - invalid parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'bad_request',
                  message: 'Invalid value for min_relevancy: must be 0-100',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - missing or invalid API key',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'unauthorized',
                  message: 'Invalid or missing API key',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'internal_error',
                  message: 'An unexpected error occurred',
                },
              },
            },
          },
        },
      },
    },
    '/topics': {
      get: {
        operationId: 'getTopics',
        summary: 'Get topics',
        description: 'Retrieve all topics with nugget counts. Useful for building topic-based navigation or filtering.',
        tags: ['Topics'],
        responses: {
          '200': {
            description: 'Successful response with topics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TopicsResponse',
                },
                example: {
                  topics: [
                    {
                      topic: 'AI Development',
                      count: 25,
                      unread_count: 12,
                      saved_count: 5,
                    },
                    {
                      topic: 'Business Strategy',
                      count: 18,
                      unread_count: 8,
                      saved_count: 3,
                    },
                  ],
                  meta: {
                    total_topics: 2,
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - missing or invalid API key',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key in format: sd_live_<32-character-string>',
      },
    },
    schemas: {
      Nugget: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the nugget',
          },
          title: {
            type: 'string',
            description: 'Title of the nugget',
          },
          description: {
            type: 'string',
            description: 'Detailed description or summary of the nugget content',
          },
          relevancy_score: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'AI-generated relevancy score based on user interests (0-100)',
          },
          topic: {
            type: 'string',
            nullable: true,
            description: 'Topic category assigned to the nugget',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Tags associated with the nugget',
          },
          source: {
            type: 'string',
            description: 'Name of the newsletter or source',
          },
          link: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL to the original content',
          },
          published_date: {
            type: 'string',
            format: 'date-time',
            description: 'Original publication date of the content',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'When the nugget was created in Signal Digest',
          },
          status: {
            type: 'string',
            enum: ['unread', 'saved', 'archived'],
            description: 'Current status of the nugget',
          },
          user_notes: {
            type: 'string',
            nullable: true,
            description: 'User-added notes about the nugget',
          },
          related_sources: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/RelatedSource',
            },
            description: 'Other sources reporting the same story (duplicates grouped together)',
          },
        },
        required: [
          'id',
          'title',
          'description',
          'relevancy_score',
          'tags',
          'source',
          'published_date',
          'created_at',
          'status',
          'related_sources',
        ],
      },
      RelatedSource: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the related nugget',
          },
          source: {
            type: 'string',
            description: 'Name of the newsletter or source',
          },
          title: {
            type: 'string',
            description: 'Title from this source',
          },
          link: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL to the original content',
          },
        },
        required: ['id', 'source', 'title'],
      },
      Topic: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic name',
          },
          count: {
            type: 'integer',
            description: 'Total number of nuggets in this topic',
          },
          unread_count: {
            type: 'integer',
            description: 'Number of unread nuggets in this topic',
          },
          saved_count: {
            type: 'integer',
            description: 'Number of saved nuggets in this topic',
          },
        },
        required: ['topic', 'count', 'unread_count', 'saved_count'],
      },
      NuggetsResponse: {
        type: 'object',
        properties: {
          nuggets: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Nugget',
            },
          },
          meta: {
            type: 'object',
            properties: {
              total: {
                type: 'integer',
                description: 'Total number of nuggets matching the query',
              },
              returned: {
                type: 'integer',
                description: 'Number of nuggets returned in this response',
              },
              filters_applied: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    nullable: true,
                  },
                  topic: {
                    type: 'string',
                    nullable: true,
                  },
                  min_relevancy: {
                    type: 'integer',
                    nullable: true,
                  },
                  since: {
                    type: 'string',
                    nullable: true,
                  },
                  tags: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        required: ['nuggets', 'meta'],
      },
      TopicsResponse: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Topic',
            },
          },
          meta: {
            type: 'object',
            properties: {
              total_topics: {
                type: 'integer',
                description: 'Total number of topics',
              },
            },
          },
        },
        required: ['topics', 'meta'],
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error code',
            enum: ['unauthorized', 'bad_request', 'internal_error'],
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
          },
        },
        required: ['error', 'message'],
      },
    },
  },
  tags: [
    {
      name: 'Nuggets',
      description: 'Operations for retrieving nuggets (extracted pieces of valuable information)',
    },
    {
      name: 'Topics',
      description: 'Operations for retrieving topic information and counts',
    },
  ],
}
