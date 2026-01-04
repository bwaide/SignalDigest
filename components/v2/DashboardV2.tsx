'use client'

import { useState, useMemo, useEffect } from 'react'
import { CommandBar } from './CommandBar'
import { FilterRail } from './FilterRail'
import { NuggetCard } from './NuggetCard'
import { EmptyStateV2 } from './EmptyStateV2'
import type { SignalSourceStatus } from '@/types/signal-sources'

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
}

interface DashboardV2Props {
  nuggets: Nugget[]
  emailStatus?: SignalSourceStatus
}

export function DashboardV2({ nuggets: initialNuggets, emailStatus }: DashboardV2Props) {
  const [nuggets, setNuggets] = useState(initialNuggets)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setNuggets(initialNuggets)
  }, [initialNuggets])

  const handleNuggetUpdate = (nuggetId: string, isRead: boolean) => {
    setNuggets((prev) =>
      prev.map((nugget) =>
        nugget.id === nuggetId ? { ...nugget, is_read: isRead } : nugget
      )
    )
  }

  // Filter nuggets
  const filteredNuggets = useMemo(() => {
    return nuggets.filter((nugget) => {
      // Filter by topic (using the structured topic field, not tags)
      if (selectedTopic && nugget.topic !== selectedTopic) {
        return false
      }

      // Filter by unread status
      if (unreadOnly && nugget.is_read) {
        return false
      }

      // Filter by search query (search in title, description, tags, and topic)
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
  }, [nuggets, selectedTopic, unreadOnly, searchQuery])

  // Sort by relevancy score (highest first)
  const sortedNuggets = useMemo(() => {
    return [...filteredNuggets].sort((a, b) => b.relevancy_score - a.relevancy_score)
  }, [filteredNuggets])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Command Bar */}
      <CommandBar
        emailStatus={emailStatus}
        onSearch={setSearchQuery}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
      />

      {/* Main Content Area */}
      <main className="flex-1 pt-24 pb-32 px-6">
        <div className="max-w-screen-2xl mx-auto">
          {sortedNuggets.length > 0 ? (
            <>
              {/* Stats Header */}
              <div className="mb-8">
                <h2 className="font-display font-black text-5xl md:text-6xl tracking-tighter mb-2">
                  {selectedTopic ? selectedTopic.toUpperCase() : 'YOUR NUGGETS'}
                </h2>
                <p className="font-serif text-lg text-foreground/60">
                  {sortedNuggets.length} insight{sortedNuggets.length !== 1 ? 's' : ''} from your newsletters
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
                    onToggleRead={handleNuggetUpdate}
                    index={index}
                  />
                ))}
              </div>
            </>
          ) : nuggets.length > 0 ? (
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
                    setUnreadOnly(false)
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
          )}
        </div>
      </main>

      {/* Filter Rail */}
      {nuggets.length > 0 && (
        <FilterRail
          nuggets={nuggets}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
        />
      )}
    </div>
  )
}
