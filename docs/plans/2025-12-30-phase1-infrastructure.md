# Phase 1: Infrastructure & Scaffolding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up complete project infrastructure with Next.js, Supabase, and basic dashboard layout ready for feature development

**Architecture:** Next.js 14 App Router with TypeScript, Supabase for backend (PostgreSQL + Auth + Edge Functions), Tailwind CSS for styling, deployed via Coolify on Hetzner

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase Client SDK, React Query, Zustand

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`

**Step 1: Initialize Next.js with TypeScript**

```bash
cd ~/Development/signal-digest
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Answer prompts:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: No
- App Router: Yes
- Import alias: Yes (@/*)

**Step 2: Verify installation**

```bash
npm run dev
```

Expected: Dev server starts on http://localhost:3000

Stop server: Ctrl+C

**Step 3: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs @tanstack/react-query zustand
npm install -D @types/node
```

**Step 4: Create environment file template**

Create: `.env.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Gateway
AI_GATEWAY_URL=your-gateway-url
AI_GATEWAY_API_KEY=your-gateway-key
```

Create: `.env.local` (copy from .env.example, will be configured later)

```bash
cp .env.example .env.local
```

**Step 5: Update .gitignore**

Modify: `.gitignore`

Add to existing file:
```gitignore
# Environment
.env.local
.env*.local

# Supabase
supabase/.branches
supabase/.temp
```

**Step 6: Commit**

```bash
git add .
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind

- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS setup
- Supabase and React Query dependencies
- Environment file template

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Set Up Supabase Project

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20250101000001_initial_schema.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

**Step 1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
```

Verify:
```bash
supabase --version
```

Expected: Version number displayed

**Step 2: Initialize Supabase locally**

```bash
cd ~/Development/signal-digest
supabase init
```

Expected: Creates `supabase/` directory with config files

**Step 3: Start local Supabase**

```bash
supabase start
```

Expected: Outputs local Supabase URLs and keys
Save these for `.env.local`

**Step 4: Create initial database schema**

Create: `supabase/migrations/20250101000001_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('email', 'youtube', 'social_media', 'rss', 'podcast')),
  raw_content TEXT,
  title TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  source_url TEXT,
  received_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nuggets table
CREATE TABLE nuggets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  signal_id UUID REFERENCES signals NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  link TEXT,
  source TEXT NOT NULL,
  published_date TIMESTAMPTZ NOT NULL,
  relevancy_score INTEGER NOT NULL CHECK (relevancy_score >= 0 AND relevancy_score <= 100),
  tags TEXT[] NOT NULL DEFAULT '{}',
  duplicate_group_id UUID,
  is_primary BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  interests_description TEXT,
  relevancy_threshold INTEGER DEFAULT 60 CHECK (relevancy_threshold >= 0 AND relevancy_threshold <= 100),
  approved_topics TEXT[] DEFAULT ARRAY[
    'AI Development',
    'AI Tools & Applications',
    'Business Strategy',
    'Consulting & Services',
    'Productivity & Automation',
    'Marketing & Sales',
    'Operations & Finance',
    'Tech Industry',
    'Self-Development'
  ],
  email_check_frequency INTERVAL DEFAULT '6 hours',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create processing_errors table
CREATE TABLE processing_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id UUID REFERENCES signals,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX idx_signals_user_status ON signals(user_id, status, received_date);
CREATE INDEX idx_nuggets_user_created ON nuggets(user_id, created_at DESC);
CREATE INDEX idx_nuggets_duplicate_group ON nuggets(duplicate_group_id);
CREATE INDEX idx_nuggets_tags ON nuggets USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuggets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signals
CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
  ON signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
  ON signals FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for nuggets
CREATE POLICY "Users can view own nuggets"
  ON nuggets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nuggets"
  ON nuggets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nuggets"
  ON nuggets FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for processing_errors
CREATE POLICY "Users can view errors for own signals"
  ON processing_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM signals
      WHERE signals.id = processing_errors.signal_id
      AND signals.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Step 5: Apply migration**

```bash
supabase db reset
```

Expected: Migration applied successfully

**Step 6: Verify tables created**

```bash
supabase db diff
```

Expected: Shows schema in sync

**Step 7: Create Supabase client utilities**

Create: `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create: `lib/supabase/server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

**Step 8: Update .env.local with local Supabase credentials**

Modify: `.env.local`

```env
# From supabase start output
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# AI Gateway (leave for now)
AI_GATEWAY_URL=
AI_GATEWAY_API_KEY=
```

**Step 9: Commit**

```bash
git add supabase/ lib/
git commit -m "feat: set up Supabase with database schema

- Initialize Supabase project
- Create initial migration with all tables
- Add RLS policies for data isolation
- Create Supabase client utilities
- Add indexes for performance

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Configure Authentication

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `middleware.ts`
- Create: `lib/types/database.ts`

**Step 1: Create auth callback route**

Create: `app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return error
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

**Step 2: Create middleware for session refresh**

Create: `middleware.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 3: Create TypeScript types for database**

Create: `lib/types/database.ts`

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      signals: {
        Row: {
          id: string
          user_id: string
          signal_type: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content: string | null
          title: string
          source_identifier: string
          source_url: string | null
          received_date: string
          processed_at: string | null
          status: 'pending' | 'processed' | 'failed'
          error_message: string | null
          retry_count: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_type: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content?: string | null
          title: string
          source_identifier: string
          source_url?: string | null
          received_date: string
          processed_at?: string | null
          status?: 'pending' | 'processed' | 'failed'
          error_message?: string | null
          retry_count?: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          signal_type?: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content?: string | null
          title?: string
          source_identifier?: string
          source_url?: string | null
          received_date?: string
          processed_at?: string | null
          status?: 'pending' | 'processed' | 'failed'
          error_message?: string | null
          retry_count?: number
          metadata?: Json | null
          created_at?: string
        }
      }
      nuggets: {
        Row: {
          id: string
          user_id: string
          signal_id: string
          title: string
          description: string
          content: string | null
          link: string | null
          source: string
          published_date: string
          relevancy_score: number
          tags: string[]
          duplicate_group_id: string | null
          is_primary: boolean
          is_read: boolean
          read_at: string | null
          is_archived: boolean
          user_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_id: string
          title: string
          description: string
          content?: string | null
          link?: string | null
          source: string
          published_date: string
          relevancy_score: number
          tags?: string[]
          duplicate_group_id?: string | null
          is_primary?: boolean
          is_read?: boolean
          read_at?: string | null
          is_archived?: boolean
          user_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          signal_id?: string
          title?: string
          description?: string
          content?: string | null
          link?: string | null
          source?: string
          published_date?: string
          relevancy_score?: number
          tags?: string[]
          duplicate_group_id?: string | null
          is_primary?: boolean
          is_read?: boolean
          read_at?: string | null
          is_archived?: boolean
          user_notes?: string | null
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          interests_description: string | null
          relevancy_threshold: number
          approved_topics: string[]
          email_check_frequency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          interests_description?: string | null
          relevancy_threshold?: number
          approved_topics?: string[]
          email_check_frequency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          interests_description?: string | null
          relevancy_threshold?: number
          approved_topics?: string[]
          email_check_frequency?: string
          created_at?: string
          updated_at?: string
        }
      }
      processing_errors: {
        Row: {
          id: string
          signal_id: string | null
          error_type: string
          error_message: string
          stack_trace: string | null
          occurred_at: string
          resolved: boolean
        }
        Insert: {
          id?: string
          signal_id?: string | null
          error_type: string
          error_message: string
          stack_trace?: string | null
          occurred_at?: string
          resolved?: boolean
        }
        Update: {
          id?: string
          signal_id?: string | null
          error_type?: string
          error_message?: string
          stack_trace?: string | null
          occurred_at?: string
          resolved?: boolean
        }
      }
    }
  }
}
```

**Step 4: Commit**

```bash
git add app/auth/ middleware.ts lib/types/
git commit -m "feat: configure Supabase authentication

- Add auth callback route handler
- Create middleware for session refresh
- Add TypeScript database types
- Enable authentication flow

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Basic Dashboard Layout

**Files:**
- Create: `app/layout.tsx` (modify existing)
- Create: `app/page.tsx` (modify existing)
- Create: `app/globals.css` (modify existing)
- Create: `components/layout/Header.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/dashboard/EmptyState.tsx`

**Step 1: Update root layout**

Modify: `app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Signal Digest',
  description: 'Transform newsletter overload into actionable insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Step 2: Update global styles**

Modify: `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 3: Create Header component**

Create: `components/layout/Header.tsx`

```typescript
'use client'

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">Signal Digest</h1>
          <span className="text-sm text-muted-foreground">
            Last sync: Never
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled
          >
            🔄 Check Now
          </button>
          <button
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            disabled
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    </header>
  )
}
```

**Step 4: Create Sidebar component**

Create: `components/layout/Sidebar.tsx`

```typescript
'use client'

const TOPICS = [
  'AI Development',
  'AI Tools & Applications',
  'Business Strategy',
  'Consulting & Services',
  'Productivity & Automation',
  'Marketing & Sales',
  'Operations & Finance',
  'Tech Industry',
  'Self-Development',
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white p-4">
      <div className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Topics</h2>
          <div className="space-y-1">
            <button className="w-full rounded-md bg-accent px-3 py-2 text-left text-sm font-medium">
              All Topics (0)
            </button>
            {TOPICS.map((topic) => (
              <button
                key={topic}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {topic} (0)
              </button>
            ))}
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" defaultChecked />
            Unread only
          </label>
        </div>
        <div>
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </aside>
  )
}
```

**Step 5: Create EmptyState component**

Create: `components/dashboard/EmptyState.tsx`

```typescript
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <svg
          className="h-12 w-12 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold mb-2">No nuggets yet</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Connect your email account and check for newsletters to get started with
        your personalized digest.
      </p>
      <button
        className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        disabled
      >
        Configure Email Account
      </button>
    </div>
  )
}
```

**Step 6: Update homepage**

Modify: `app/page.tsx`

```typescript
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmptyState } from '@/components/dashboard/EmptyState'

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <EmptyState />
        </main>
      </div>
    </div>
  )
}
```

**Step 7: Test the layout**

```bash
npm run dev
```

Expected: Dashboard loads with header, sidebar, and empty state
Navigate to: http://localhost:3000

Visual check:
- ✅ Header with "Signal Digest" title
- ✅ "Check Now" and "Settings" buttons (disabled)
- ✅ Sidebar with 9 topics listed
- ✅ Empty state in main content area
- ✅ Responsive layout

Stop server: Ctrl+C

**Step 8: Commit**

```bash
git add app/ components/
git commit -m "feat: create basic dashboard layout

- Add Header component with branding and actions
- Add Sidebar with topic navigation
- Add EmptyState for initial view
- Update homepage with complete layout
- Add custom color scheme with Tailwind

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Prepare for Deployment

**Files:**
- Create: `.dockerignore`
- Create: `DEPLOYMENT.md`
- Modify: `README.md`

**Step 1: Create .dockerignore**

Create: `.dockerignore`

```
node_modules
.next
.git
.env*.local
.DS_Store
*.log
supabase/.branches
supabase/.temp
```

**Step 2: Create deployment documentation**

Create: `DEPLOYMENT.md`

```markdown
# Deployment Guide

## Prerequisites

- Hetzner VPS with Coolify installed
- Supabase project (production)
- GitHub repository

## Steps

### 1. Create Production Supabase Project

Via Supabase Dashboard:
1. Create new project: "signal-digest-prod"
2. Wait for provisioning (2-3 minutes)
3. Save credentials:
   - Project URL
   - Anon key
   - Service role key

### 2. Apply Database Migrations

```bash
# Link to production project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### 3. Configure Coolify

1. Create new project in Coolify
2. Source: GitHub repository
3. Build Pack: Nixpacks (auto-detected)
4. Branch: `main`
5. Auto-deploy: ✅ Enabled

Environment Variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[production-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[production-service-role-key]
AI_GATEWAY_URL=[your-gateway-url]
AI_GATEWAY_API_KEY=[your-gateway-key]
```

### 4. Deploy

```bash
git push origin main
```

Coolify will:
- Detect Next.js project
- Install dependencies
- Build production bundle
- Deploy with zero downtime
- Configure SSL via Let's Encrypt

### 5. Verify Deployment

1. Visit deployed URL
2. Check dashboard loads
3. Verify Supabase connection
4. Test authentication flow (coming in Phase 2)

## Troubleshooting

### Build fails
- Check Coolify logs
- Verify environment variables
- Ensure Node.js version compatibility

### Database connection errors
- Verify SUPABASE_URL is correct
- Check RLS policies are enabled
- Confirm migrations applied

### SSL issues
- Wait 2-3 minutes for Let's Encrypt
- Check domain DNS configuration
- Review Coolify SSL logs
```

**Step 3: Update README with setup instructions**

Modify: `README.md` (add to beginning)

```markdown
# Signal Digest

> Transform newsletter overload into a personalized, AI-curated news digest

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase CLI
- Supabase account (for production)

### Local Development

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/signal-digest.git
   cd signal-digest
   npm install
   ```

2. **Start Supabase:**
   ```bash
   supabase start
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Update with Supabase credentials from 'supabase start' output
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open dashboard:**
   Navigate to http://localhost:3000

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Coolify deployment instructions.

---

<!-- Existing README content below -->
```

**Step 4: Verify everything works locally**

```bash
# Ensure Supabase is running
supabase status

# Start dev server
npm run dev
```

Navigate to http://localhost:3000
Expected: Dashboard loads successfully

Stop server: Ctrl+C

**Step 5: Final commit**

```bash
git add .dockerignore DEPLOYMENT.md README.md
git commit -m "docs: add deployment configuration and guides

- Add .dockerignore for Coolify builds
- Create comprehensive deployment guide
- Update README with quick start
- Ready for production deployment

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 6: Push to GitHub**

```bash
# Add remote (replace with your repository)
git remote add origin https://github.com/yourusername/signal-digest.git

# Push
git push -u origin main
```

---

## Completion Checklist

**Infrastructure:**
- ✅ Next.js 14 project initialized with TypeScript
- ✅ Tailwind CSS configured
- ✅ Dependencies installed (Supabase, React Query, Zustand)
- ✅ Environment files configured

**Supabase:**
- ✅ Local Supabase running
- ✅ Database schema created (signals, nuggets, user_settings, processing_errors)
- ✅ Row Level Security policies enabled
- ✅ Indexes created for performance
- ✅ Supabase client utilities created
- ✅ TypeScript types generated

**Authentication:**
- ✅ Auth callback route created
- ✅ Middleware for session refresh
- ✅ Database types defined

**Dashboard:**
- ✅ Header component with branding and actions
- ✅ Sidebar with topic navigation
- ✅ Empty state component
- ✅ Responsive layout
- ✅ Custom color scheme

**Deployment:**
- ✅ .dockerignore configured
- ✅ Deployment documentation created
- ✅ README updated with setup instructions
- ✅ Ready for Coolify deployment

**Testing:**
- ✅ Local dev server runs successfully
- ✅ Dashboard renders correctly
- ✅ Supabase connection works
- ✅ All migrations applied

## Next Steps

**Phase 2: Email Processing**
1. IMAP connection logic
2. Content extraction (HTML → Markdown)
3. AI Gateway integration
4. Nugget extraction implementation
5. Edge Function for signal processing

See: `docs/plans/2025-12-30-phase2-email-processing.md` (to be created)

---

**Estimated Time:** 2-3 hours
**Dependencies:** None
**Blockers:** None
**Status:** Ready for execution
