# Signal Digest - Design Document

**Date:** December 30, 2025
**Status:** Approved for Implementation
**Owner:** Business Owner & AI Consultant

## Problem Statement

As an AI consultant and entrepreneur, staying current with AI development, business tools, and industry news is critical. However, subscribing to multiple newsletters leads to inbox overload - valuable information gets buried and never read.

## Solution

Build an AI-powered web application that transforms email newsletters into a curated, personalized "newspaper" of actionable insights called "nuggets."

## Core Concept

**Signals** → **Nuggets** → **Organized Dashboard**

- **Signal:** An information source (email newsletter, YouTube video, social post, etc.)
- **Nugget:** An extracted piece of valuable information with title, description, relevancy score, tags, and source link
- **Dashboard:** Topic-organized sections displaying nuggets sorted by AI-assigned priority

## Key Design Decisions

### 1. Architecture: Supabase + React

**Choice:** Supabase-powered React application
**Rationale:**
- Managed PostgreSQL, auth, and storage
- Edge Functions for serverless processing
- Built-in Row Level Security for future multi-tenant
- Focus on features, not infrastructure

### 2. Single-User MVP, Multi-Tenant Ready

**Choice:** Build for single user initially, but architect for multi-tenant expansion
**Rationale:**
- Faster to MVP without billing/onboarding complexity
- Validate AI extraction quality with real use
- Data model includes `user_id` from day one
- Easy pivot to SaaS if successful

### 3. AI Gateway Integration

**Choice:** Use existing custom AI Gateway (OpenAI-compatible API)
**Rationale:**
- Already built and maintained
- Supports multiple models (hybrid approach)
- Cost control and flexibility
- Single implementation for all LLM calls

### 4. Hybrid Model Strategy

**Choice:** Cheaper models for extraction (GPT-4o-mini), premium models for deduplication (GPT-4o)
**Rationale:**
- Newsletter parsing is straightforward
- Deduplication requires reasoning
- Dramatic cost savings at scale
- Easy to swap models via AI Gateway

### 5. Email Checking: Hybrid Automation

**Choice:** Scheduled checks (every 6 hours) + manual trigger button
**Rationale:**
- Automation keeps user current without thinking
- Manual trigger for immediate updates when needed
- Configurable frequency balances freshness vs. cost
- Supabase pg_cron handles scheduling

### 6. Deduplication: LLM-Based (Start Simple)

**Choice:** Start with LLM-based comparison, optimize to embeddings + LLM later
**Rationale:**
- Higher quality out of the gate
- Learn what similarity thresholds work
- Identify cost/performance bottlenecks before optimizing
- Can add pgvector + embeddings when scale demands it

### 7. Relevancy Scoring: LLM During Extraction

**Choice:** Natural language interest statement, LLM scores during nugget extraction
**Rationale:**
- Single-pass processing (efficient)
- Natural language works great with modern LLMs
- Easy to update preferences (just edit text field)
- Foundation for future behavioral learning

### 8. Dashboard: Topic Sections with Priority Sorting

**Choice:** Organize by AI-assigned topics, sort by relevancy within each section
**Rationale:**
- Mimics newspaper reading experience
- Natural information hierarchy (topic → priority)
- Easy to scan and prioritize within areas of interest
- Grouped duplicates surface together

### 9. Topic Management: Hybrid Controlled Vocabulary

**Choice:** 9 predefined topics + "Other" bucket, LLM can suggest new topics
**Rationale:**
- Prevents tag explosion (consistent dashboard sections)
- Flexible - LLM flags new topics for user approval
- Grows organically based on real newsletter content
- Initial topics cover AI consultant + entrepreneur needs

**Initial Topics:**
1. AI Development
2. AI Tools & Applications
3. Business Strategy
4. Consulting & Services
5. Productivity & Automation
6. Marketing & Sales
7. Operations & Finance
8. Tech Industry
9. Self-Development

### 10. Content Extraction: Smart HTML Parsing

**Choice:** Use readability libraries + HTML-to-Markdown conversion
**Rationale:**
- Removes newsletter cruft (headers, footers, tracking pixels)
- Markdown is token-efficient for LLM processing
- Preserves structure (headings, links, lists)
- Libraries like @mozilla/readability handle edge cases

### 11. Data Retention: Archive Original Signals

**Choice:** Keep full email content in database (markdown format)
**Rationale:**
- Enables re-processing if extraction logic improves
- Audit "did LLM miss something?"
- Future feature: "show me original newsletter"
- Storage is cheap vs. value of iteration capability

### 12. Granularity: One Email = Multiple Nuggets

**Choice:** LLM extracts each distinct piece of information as separate nugget
**Rationale:**
- Newsletters often contain 5-20 distinct items
- Fine-grained filtering by relevancy
- Better deduplication (story-level matching)
- More engaging dashboard (variety vs. big blocks)

### 13. Deduplication Window: 7 Days

**Choice:** Compare nuggets against last 7 days of content
**Rationale:**
- Most AI/tech news has short relevance window
- Keeps LLM costs predictable
- Still catches same story from multiple newsletters
- Can adjust based on observed patterns

### 14. Data Model: "Signals" Not "Emails"

**Choice:** Generic `signals` table with `signal_type` enum
**Rationale:**
- Future sources: YouTube, social media, RSS, podcasts
- Extensible without schema changes
- Consistent processing pipeline pattern
- Plan for scale from day one

### 15. Error Handling: Retry + Graceful Degradation

**Choice:** Retry transient errors, gracefully skip malformed emails, log everything
**Rationale:**
- Network issues shouldn't kill entire batch
- Malformed emails shouldn't block good emails
- Dashboard for failed emails enables manual review
- Production-ready from day one

### 16. Deployment: Coolify on Hetzner

**Choice:** Self-hosted using Coolify (Nixpacks auto-build)
**Rationale:**
- User already has infrastructure
- "Self-hosted Vercel" developer experience
- Git push → auto-deploy workflow
- No vendor lock-in, full control

## Technical Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** React Query + Zustand
- **Auth:** Supabase Auth

### Backend
- **Database:** Supabase PostgreSQL
- **Functions:** Supabase Edge Functions
- **Secrets:** Supabase Vault
- **Cron:** pg_cron
- **Security:** Row Level Security (RLS)

### External
- **AI:** Custom AI Gateway (OpenAI-compatible)
- **Email:** IMAP (dedicated account)
- **Deploy:** Coolify on Hetzner VPS

## Data Model

### Core Tables
1. **`signals`** - Information sources (emails, videos, posts)
2. **`nuggets`** - Extracted valuable information
3. **`user_settings`** - Preferences and configuration
4. **`processing_errors`** - Error tracking

### Key Relationships
- `nuggets.signal_id` → `signals.id` (one-to-many)
- `nuggets.duplicate_group_id` → groups similar nuggets
- `nuggets.is_primary` → identifies main nugget in duplicate group

## Processing Pipeline

1. **Trigger:** Scheduled (pg_cron) or manual (dashboard button)
2. **Fetch:** Connect to IMAP, get unread emails (limit 50)
3. **Extract:** HTML → clean Markdown via readability
4. **AI Extract:** Send to AI Gateway → array of nuggets
5. **Store:** Create nuggets linked to signal
6. **Deduplicate:** LLM compares recent nuggets, assigns groups
7. **Archive:** Mark email read, move to archive folder
8. **Display:** Dashboard fetches and organizes nuggets

## Success Metrics

### MVP Success
- ✅ Process 100% of incoming newsletters without manual intervention
- ✅ Extraction accuracy >90% (nuggets capture key information)
- ✅ Relevancy scoring accuracy >80% (user reads high-scored items)
- ✅ Deduplication accuracy >85% (same stories grouped correctly)
- ✅ Daily active use (user checks dashboard regularly)

### Future Success
- Multi-source support (YouTube, social media, RSS)
- Multi-tenant SaaS capability
- Behavioral learning improves relevancy over time

## Implementation Phases

### Phase 1: Infrastructure (Week 1)
- Next.js project setup
- Supabase database schema
- Basic dashboard layout
- Coolify deployment

### Phase 2: Email Processing (Week 2)
- IMAP connection
- Content extraction
- AI Gateway integration
- Edge Function for processing

### Phase 3: Deduplication (Week 3)
- Deduplication logic
- Edge Function implementation
- Prompt refinement
- Error handling

### Phase 4: Dashboard (Week 4)
- Topic sections
- Nugget cards
- Filtering/search
- Settings modal
- User interactions

### Phase 5: Polish (Week 5)
- Scheduled automation
- Manual trigger
- Error dashboard
- Performance optimization
- Testing and deployment

## Risks & Mitigations

### Risk: LLM Extraction Quality
**Mitigation:** Keep original emails for re-processing, iterate on prompts, validate with real use

### Risk: Deduplication Accuracy
**Mitigation:** Start with high-quality LLM approach, add human review for edge cases, optimize later

### Risk: Cost Overruns (AI API)
**Mitigation:** Hybrid model strategy, monitor usage, implement rate limiting, batch processing

### Risk: IMAP Reliability
**Mitigation:** Retry logic, error logging, manual trigger fallback, connection pooling

### Risk: Newsletter Format Variability
**Mitigation:** Readability library handles most cases, error logging for failures, manual review capability

## Open Questions

None - all major decisions made during brainstorming session.

## Future Enhancements

### Near-term
- Explicit topic preferences (keyword filters)
- Behavioral learning (reading patterns improve scoring)
- Export functionality (PDF/CSV)
- Browser extension (save web articles as signals)

### Long-term
- Additional signal sources (YouTube, social media, RSS, podcasts)
- Embedding-based deduplication optimization
- Multi-tenant SaaS
- Team accounts with shared digests
- Mobile app

## References

- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Full specification: `README.md`
