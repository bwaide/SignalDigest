# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Digest is a Next.js 14 application that transforms email newsletters into AI-curated, personalized news digests. The app uses Supabase for backend (PostgreSQL + Auth + Edge Functions), processes emails via IMAP, and extracts "nuggets" of information using an AI Gateway.

**Architecture:** Next.js App Router with TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), Edge Functions for processing, deployed via Coolify on Hetzner.

## Development Commands

### Local Development
```bash
# Start local development server
npm run dev

# Build production bundle
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Supabase Commands
```bash
# Start local Supabase (includes PostgreSQL, Auth, Storage, Edge Functions)
supabase start

# Stop local Supabase
supabase stop

# Reset database (drops all data and re-runs migrations)
supabase db reset

# Check database diff
supabase db diff

# Create a new migration
supabase migration new <migration_name>

# Apply migrations to local database
supabase db push

# Generate TypeScript types from database schema
supabase gen types typescript --local > lib/types/database-generated.ts

# View Supabase Studio (database UI)
# Automatically available at http://127.0.0.1:54333 after supabase start

# Deploy Edge Functions to production
supabase functions deploy <function-name>

# Serve Edge Functions locally for testing
supabase functions serve <function-name>
```

## Architecture & Project Structure

### Database Schema
The application has four main tables in PostgreSQL with Row Level Security (RLS):

1. **`signals`** - Raw information sources (emails, future: videos, posts)
   - Stores original content, metadata, processing status
   - Has retry logic with `retry_count` and `error_message` fields
   - Status: 'pending' | 'processed' | 'failed'

2. **`nuggets`** - Extracted pieces of valuable information
   - Each signal produces multiple nuggets via AI extraction
   - Contains `relevancy_score` (0-100) for personalization
   - Supports deduplication via `duplicate_group_id` and `is_primary`
   - Has read/archive tracking and user notes

3. **`user_settings`** - User preferences
   - `interests_description`: Natural language description for AI relevancy scoring
   - `relevancy_threshold`: Min score (0-100) to display nuggets
   - `approved_topics`: Array of topic tags for categorization
   - `email_check_frequency`: INTERVAL for scheduled checks

4. **`processing_errors`** - Error tracking and debugging
   - Linked to signals for detailed error analysis

### Key Architectural Patterns

**Authentication Flow:**
- Supabase Auth with SSR support
- `lib/supabase/client.ts` for client-side operations
- `lib/supabase/server.ts` for server-side operations (uses cookies)
- `app/auth/callback/route.ts` handles OAuth callback
- `middleware.ts` refreshes sessions on every request

**Email Processing Pipeline:**
1. Trigger (scheduled via pg_cron or manual)
2. Connect to IMAP → Fetch unread emails
3. Extract clean content (HTML → Markdown using Readability + Turndown)
4. AI Gateway extracts multiple nuggets per email with structured JSON
5. Store nuggets with relevancy scores
6. Deduplication pass (7-day rolling window, groups similar nuggets)
7. Mark email as read and archive

**AI Integration:**
- Custom AI Gateway with OpenAI-compatible API
- Two main prompts:
  - **Extraction prompt**: Identifies nuggets from newsletter content with relevancy scoring
  - **Deduplication prompt**: Groups similar nuggets from different sources
- Uses structured JSON responses (`response_format: { type: 'json_object' }`)

**State Management:**
- Server state: React Query (@tanstack/react-query) for data fetching
- UI state: Zustand for client-side state
- Database types in `lib/types/database.ts` for type safety

### Important Files

**Core Infrastructure:**
- `lib/supabase/client.ts` - Client-side Supabase client (uses @supabase/ssr)
- `lib/supabase/server.ts` - Server-side Supabase client with cookie handling
- `lib/types/database.ts` - TypeScript types for all database tables
- `middleware.ts` - Session refresh middleware (runs on all routes)

**Database:**
- `supabase/config.toml` - Supabase local configuration
- `supabase/migrations/` - Database migration files (timestamped SQL)
- Migration naming: `YYYYMMDDHHMMSS_description.sql`

**Edge Functions (Future):**
- `supabase/functions/process-signals/` - Email processing pipeline
- `supabase/functions/deduplicate-nuggets/` - Deduplication logic

**Components:**
- `components/layout/` - Header, Sidebar, layout components
- `components/dashboard/` - Dashboard-specific components (EmptyState, NuggetCard)

## Important Development Notes

### Database Migrations
- **Never run migrations automatically** - User must execute manually
- Always use timestamped migration format: `supabase migration new <name>`
- Test migrations locally with `supabase db reset` before pushing to production
- RLS policies are critical - all tables have user-scoped access controls
- When adding new tables, always add RLS policies

### Supabase Client Usage
- **Client components**: Use `createClient()` from `lib/supabase/client.ts`
- **Server components**: Use `createClient()` from `lib/supabase/server.ts`
- **Server actions**: Use server.ts client (has cookie access)
- Never expose service role key to client-side code

### Environment Variables
- `.env.local` is gitignored and required for local development
- `.env.example` provides template
- Required vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (public, RLS enforces security)
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only, bypasses RLS)
  - `AI_GATEWAY_URL` - AI Gateway endpoint
  - `AI_GATEWAY_API_KEY` - AI Gateway authentication

### Testing Requirements
- Before committing: Run full test including production build and lint
- Test commands sequence:
  ```bash
  npm run lint
  npm run build
  npm start  # Verify production build works
  ```
- Test Supabase migrations locally before applying to production
- Use `supabase db reset` to test fresh migration application

### AI Gateway Integration
- Uses OpenAI-compatible API format
- Always use `response_format: { type: 'json_object' }` for structured responses
- Handle rate limiting (429) and server errors (5xx) with exponential backoff
- Network errors (ETIMEDOUT, ECONNRESET) are retryable

### Edge Functions
- Written in TypeScript for Deno runtime
- Use `Deno.serve()` as entry point
- Can access Supabase via service role key (stored in function secrets)
- Test locally with `supabase functions serve` before deploying
- Deploy with `supabase functions deploy <function-name>`

### Deployment
- Uses Coolify for deployment (Nixpacks auto-detection)
- Deployment process:
  1. Push to `main` branch
  2. Coolify detects Next.js project
  3. Runs `npm install` and `npm run build`
  4. Deploys with zero downtime
  5. Auto-configures SSL via Let's Encrypt
- See `DEPLOYMENT.md` for full deployment guide

## Common Development Workflows

### Adding a New Feature
1. Check if database schema changes are needed
2. If yes, create migration: `supabase migration new <feature_name>`
3. Write migration SQL, test with `supabase db reset`
4. Update `lib/types/database.ts` if schema changed
5. Implement feature in Next.js app
6. Test locally with `npm run dev`
7. Run build and lint checks before committing

### Creating a Database Migration
```bash
# Create new migration file
supabase migration new add_feature_x

# Edit supabase/migrations/YYYYMMDDHHMMSS_add_feature_x.sql

# Test migration
supabase db reset

# Verify schema
supabase db diff
```

### Working with Edge Functions
```bash
# Create new function
supabase functions new process-signals

# Develop locally with hot reload
supabase functions serve process-signals

# Test function
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-signals' \
  --header 'Authorization: Bearer [anon-key]' \
  --header 'Content-Type: application/json' \
  --data '{"test": true}'

# Deploy to production (after user approval)
supabase functions deploy process-signals
```

### Debugging RLS Policies
```sql
-- Test RLS policy in Supabase Studio SQL editor
-- Switch to specific user context
SET request.jwt.claims.sub = 'user-uuid-here';

-- Run query to test access
SELECT * FROM nuggets;

-- Reset to admin context
RESET request.jwt.claims.sub;
```

## Design Philosophy

- **Simplicity First**: Avoid over-engineering, make minimum changes needed
- **Type Safety**: Use TypeScript strictly, leverage Supabase type generation
- **Security by Default**: All tables use RLS, never bypass unless necessary
- **Graceful Degradation**: Handle AI Gateway failures, IMAP errors gracefully
- **User Privacy**: Single-user initially, designed for multi-tenant future
- **Progressive Enhancement**: Start with email newsletters, extensible to other sources

## References

- Full product specification: `README.md`
- Design document: `docs/plans/2025-12-30-signal-digest-design.md`
- Phase 1 implementation plan: `docs/plans/2025-12-30-phase1-infrastructure.md`
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
