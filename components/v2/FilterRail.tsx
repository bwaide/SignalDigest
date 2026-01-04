'use client'

import { useState } from 'react'

interface Nugget {
  topic: string
  is_read: boolean
}

interface FilterRailProps {
  nuggets: Nugget[]
  selectedTopic: string | null
  onTopicChange: (topic: string | null) => void
}

const TOPIC_COLORS: Record<string, string> = {
  'AI & Machine Learning': 'bg-[hsl(var(--electric-blue))]',
  'Social Media & Culture': 'bg-[hsl(var(--cyber-pink))]',
  'Tech Products & Innovation': 'bg-[hsl(var(--neon-green))]',
  'Business & Finance': 'bg-[hsl(var(--warning-orange))]',
  'Startups & Funding': 'bg-[hsl(var(--warning-orange))]',
  'Climate & Energy': 'bg-[hsl(var(--neon-green))]',
  'Health & Science': 'bg-[hsl(var(--electric-blue))]',
  'Policy & Regulation': 'bg-black',
}

export function FilterRail({ nuggets, selectedTopic, onTopicChange }: FilterRailProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate topic counts from the topic field (not tags)
  const topicCounts = nuggets.reduce((acc, nugget) => {
    acc[nugget.topic] = (acc[nugget.topic] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Sort topics by count
  const sortedTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([topic]) => topic)

  const totalCount = nuggets.length

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 px-6 py-3 bg-black text-white border-2 border-black shadow-brutal hover:shadow-brutal-hover hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all font-display font-black z-40"
      >
        TOPICS ({sortedTopics.length})
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t-4 border-black">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-black text-sm tracking-tight">
            FILTER BY TOPIC
          </h3>
          <button
            onClick={() => setIsExpanded(false)}
            className="px-3 py-1 hover:bg-black hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => onTopicChange(null)}
            className={`px-4 py-2 border-2 border-black transition-all whitespace-nowrap font-serif ${
              selectedTopic === null
                ? 'bg-black text-white shadow-brutal-sm'
                : 'bg-white hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
          >
            All ({totalCount})
          </button>

          {sortedTopics.map((topic) => {
            const colorClass = TOPIC_COLORS[topic] || 'bg-black'
            const isActive = selectedTopic === topic

            return (
              <button
                key={topic}
                onClick={() => onTopicChange(topic)}
                className={`px-4 py-2 border-2 border-black transition-all whitespace-nowrap font-serif ${
                  isActive
                    ? `${colorClass} text-white shadow-brutal-sm`
                    : 'bg-white hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px]'
                }`}
              >
                {topic} ({topicCounts[topic]})
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
