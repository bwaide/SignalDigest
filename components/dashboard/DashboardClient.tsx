'use client'

import { useState, useMemo, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { NuggetList } from './NuggetList'
import { EmptyState } from './EmptyState'

interface Nugget {
  id: string
  title: string
  description: string
  content: string | null
  link: string | null
  source: string
  published_date: string
  relevancy_score: number
  tags: string[]
  is_read: boolean
}

interface DashboardClientProps {
  nuggets: Nugget[]
}

export function DashboardClient({ nuggets: initialNuggets }: DashboardClientProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [nuggets, setNuggets] = useState(initialNuggets)

  // Update local state when props change (e.g., after page refresh)
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

  // Filter nuggets based on selected filters
  const filteredNuggets = useMemo(() => {
    return nuggets.filter((nugget) => {
      // Filter by topic
      if (selectedTopic && !nugget.tags.includes(selectedTopic)) {
        return false
      }

      // Filter by unread status
      if (unreadOnly && nugget.is_read) {
        return false
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = nugget.title.toLowerCase().includes(query)
        const matchesDescription = nugget.description.toLowerCase().includes(query)
        const matchesTags = nugget.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        )
        if (!matchesTitle && !matchesDescription && !matchesTags) {
          return false
        }
      }

      return true
    })
  }, [nuggets, selectedTopic, unreadOnly, searchQuery])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        nuggets={nuggets}
        selectedTopic={selectedTopic}
        onTopicChange={setSelectedTopic}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {filteredNuggets.length > 0 ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {selectedTopic || 'Your Nuggets'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {filteredNuggets.length} insight
                {filteredNuggets.length !== 1 ? 's' : ''} from your newsletters
              </p>
            </div>
            <NuggetList nuggets={filteredNuggets} onNuggetUpdate={handleNuggetUpdate} />
          </div>
        ) : nuggets.length > 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-muted-foreground">No nuggets match your filters</p>
              <button
                onClick={() => {
                  setSelectedTopic(null)
                  setUnreadOnly(false)
                  setSearchQuery('')
                }}
                className="mt-4 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  )
}
