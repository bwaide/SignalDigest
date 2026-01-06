'use client'

import { useState, useMemo, useEffect } from 'react'
import { CommandBar } from './CommandBar'
import { FilterRail } from './FilterRail'
import { NuggetCard } from './NuggetCard'
import { InboxView } from './InboxView'
import { ArchiveView } from './ArchiveView'
import { EmptyStateV2 } from './EmptyStateV2'
import type { SignalSourceStatus } from '@/types/signal-sources'

type NuggetStatus = 'unread' | 'archived' | 'saved'
type ViewMode = 'inbox' | 'saved' | 'archive'

interface Nugget {
  id: string
  title: string
  description: string
  content: string | null
  link: string | null
  source: string
  published_date: string
  relevancy_score: number
  topic: string
  tags: string[]
  is_read: boolean
  status: NuggetStatus
}

interface DashboardV2Props {
  nuggets: Nugget[]
  archivedNuggets: Nugget[]
  emailStatus?: SignalSourceStatus
  autoSyncEnabled?: boolean
  autoSyncIntervalMinutes?: number
}

export function DashboardV2({
  nuggets: initialNuggets,
  archivedNuggets: initialArchived,
  emailStatus,
  autoSyncEnabled = false,
  autoSyncIntervalMinutes = 30
}: DashboardV2Props) {
  const [nuggets, setNuggets] = useState(initialNuggets)
  const [archivedNuggets, setArchivedNuggets] = useState(initialArchived)
  const [viewMode, setViewMode] = useState<ViewMode>('inbox')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Auto-sync is now handled server-side via pg_cron
  // No client-side auto-sync needed

  useEffect(() => {
    setNuggets(initialNuggets)
  }, [initialNuggets])

  useEffect(() => {
    setArchivedNuggets(initialArchived)
  }, [initialArchived])

  const handleStatusUpdate = (nuggetId: string, status: NuggetStatus) => {
    // Update in appropriate list
    const updateNugget = (prev: Nugget[]) =>
      prev.map((nugget) =>
        nugget.id === nuggetId
          ? {
              ...nugget,
              status,
              is_read: status !== 'unread'
            }
          : nugget
      )

    setNuggets(updateNugget)
    setArchivedNuggets(updateNugget)
  }

  // Separate nuggets by status
  const inboxNuggets = useMemo(() =>
    nuggets.filter(n => n.status === 'unread'),
    [nuggets]
  )

  const savedNuggets = useMemo(() =>
    nuggets.filter(n => n.status === 'saved'),
    [nuggets]
  )

  // Filter nuggets based on current view
  const filteredNuggets = useMemo(() => {
    const currentList = viewMode === 'inbox' ? inboxNuggets :
                       viewMode === 'saved' ? savedNuggets :
                       archivedNuggets

    return currentList.filter((nugget) => {
      // Filter by topic
      if (selectedTopic && nugget.topic !== selectedTopic) {
        return false
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = nugget.title.toLowerCase().includes(query)
        const matchesDescription = nugget.description.toLowerCase().includes(query)
        const matchesTopic = nugget.topic.toLowerCase().includes(query)
        const matchesTags = nugget.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        )
        if (!matchesTitle && !matchesDescription && !matchesTopic && !matchesTags) {
          return false
        }
      }

      return true
    })
  }, [viewMode, inboxNuggets, savedNuggets, archivedNuggets, selectedTopic, searchQuery])

  // Sort saved nuggets by relevancy
  const sortedNuggets = useMemo(() => {
    if (viewMode !== 'saved') return filteredNuggets
    return [...filteredNuggets].sort((a, b) => b.relevancy_score - a.relevancy_score)
  }, [filteredNuggets, viewMode])

  // Get all nuggets for current view for topic counting
  const nuggetsForCounting = viewMode === 'inbox' ? inboxNuggets :
                             viewMode === 'saved' ? savedNuggets :
                             archivedNuggets

  return (
    <div className="min-h-screen flex flex-col">
      {/* Command Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
        <CommandBar
          emailStatus={emailStatus}
          onSearch={setSearchQuery}
          showUnreadFilter={false}
        />
      </div>

      {/* View Tabs - separate fixed element below command bar - adjusted for mobile CommandBar height */}
      <div className="fixed top-[100px] md:top-[84px] left-0 right-0 z-40 bg-white border-b-2 border-black/10">
        <div className="max-w-screen-2xl mx-auto px-3 md:px-6 flex gap-0">
          <button
            onClick={() => setViewMode('inbox')}
            className={`flex-1 md:flex-none md:px-6 py-2.5 md:py-3 font-display font-black text-xs md:text-sm transition-all border-r-2 border-black/10 ${
              viewMode === 'inbox'
                ? 'bg-[hsl(var(--electric-blue))] text-white'
                : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            INBOX {inboxNuggets.length > 0 && `(${inboxNuggets.length})`}
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`flex-1 md:flex-none md:px-6 py-2.5 md:py-3 font-display font-black text-xs md:text-sm transition-all border-r-2 border-black/10 ${
              viewMode === 'saved'
                ? 'bg-[hsl(var(--neon-green))] text-black'
                : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            SAVED {savedNuggets.length > 0 && `(${savedNuggets.length})`}
          </button>
          <button
            onClick={() => setViewMode('archive')}
            className={`flex-1 md:flex-none md:px-6 py-2.5 md:py-3 font-display font-black text-xs md:text-sm transition-all ${
              viewMode === 'archive'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            ARCHIVE {archivedNuggets.length > 0 && `(${archivedNuggets.length})`}
          </button>
        </div>
      </div>

      {/* Main Content Area - padding for both header and tabs, adjusted for mobile */}
      <main className="flex-1 pt-[152px] md:pt-[148px] pb-32 px-2 md:px-6">
        {/* Inbox View - Full-screen card interface */}
        {viewMode === 'inbox' && (
          filteredNuggets.length > 0 ? (
            <InboxView
              nuggets={filteredNuggets}
              onUpdateStatus={handleStatusUpdate}
            />
          ) : inboxNuggets.length > 0 ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center max-w-md">
                <h3 className="font-display font-black text-4xl mb-4 tracking-tight">
                  NO MATCHES
                </h3>
                <p className="font-serif text-lg text-foreground/60 mb-6">
                  Try adjusting your filters or search query
                </p>
                <button
                  onClick={() => {
                    setSelectedTopic(null)
                    setSearchQuery('')
                  }}
                  className="px-8 py-3 bg-black text-white border-2 border-black shadow-brutal hover:shadow-brutal-hover hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all font-display font-black"
                >
                  CLEAR FILTERS
                </button>
              </div>
            </div>
          ) : (
            <EmptyStateV2 emailStatus={emailStatus} />
          )
        )}

        {/* Saved View - Magazine-style grid */}
        {viewMode === 'saved' && (
          <div className="max-w-screen-2xl mx-auto">
            {sortedNuggets.length > 0 ? (
              <>
                {/* Stats Header */}
                <div className="mb-8">
                  <h2 className="font-display font-black text-5xl md:text-6xl tracking-tighter mb-2">
                    {selectedTopic ? selectedTopic.toUpperCase() : 'SAVED'}
                  </h2>
                  <p className="font-serif text-lg text-foreground/60">
                    {sortedNuggets.length} saved insight{sortedNuggets.length !== 1 ? 's' : ''}
                    {searchQuery && (
                      <span className="ml-2">
                        · searching for &quot;{searchQuery}&quot;
                      </span>
                    )}
                  </p>
                </div>

                {/* Masonry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
                  {sortedNuggets.map((nugget, index) => (
                    <NuggetCard
                      key={nugget.id}
                      nugget={nugget}
                      onUpdateStatus={handleStatusUpdate}
                      index={index}
                    />
                  ))}
                </div>
              </>
            ) : savedNuggets.length > 0 ? (
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center max-w-md">
                  <h3 className="font-display font-black text-4xl mb-4 tracking-tight">
                    NO MATCHES
                  </h3>
                  <p className="font-serif text-lg text-foreground/60 mb-6">
                    Try adjusting your filters or search query
                  </p>
                  <button
                    onClick={() => {
                      setSelectedTopic(null)
                      setSearchQuery('')
                    }}
                    className="px-8 py-3 bg-black text-white border-2 border-black shadow-brutal hover:shadow-brutal-hover hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all font-display font-black"
                  >
                    CLEAR FILTERS
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center max-w-md">
                  <h3 className="font-display font-black text-4xl mb-4 tracking-tight">
                    NO SAVED NUGGETS
                  </h3>
                  <p className="font-serif text-lg text-foreground/60">
                    Save important nuggets from your Inbox to see them here
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Archive View - Dense list */}
        {viewMode === 'archive' && (
          <ArchiveView
            nuggets={filteredNuggets}
            onUpdateStatus={handleStatusUpdate}
          />
        )}
      </main>

      {/* Filter Rail - Only show for saved/archive views, count based on current view */}
      {viewMode !== 'inbox' && nuggetsForCounting.length > 0 && (
        <FilterRail
          nuggets={nuggetsForCounting}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
        />
      )}
    </div>
  )
}
