'use client'

import { useState } from 'react'
import { SourceFavicon } from './SourceFavicon'

interface NuggetCardProps {
  nugget: {
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
  onToggleRead: (id: string, isRead: boolean) => void
  index: number
}

const getRelevancyColor = (score: number): string => {
  if (score >= 90) return 'bg-[hsl(var(--electric-blue))] text-white'
  if (score >= 75) return 'bg-[hsl(var(--neon-green))] text-black'
  if (score >= 60) return 'bg-[hsl(var(--cyber-pink))] text-white'
  return 'bg-black text-white'
}

const getRelevancyLabel = (score: number): string => {
  if (score >= 90) return 'CRITICAL'
  if (score >= 75) return 'HIGH'
  if (score >= 60) return 'MEDIUM'
  return 'LOW'
}

export function NuggetCard({ nugget, onToggleRead, index }: NuggetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggleRead = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/nuggets/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nugget_id: nugget.id,
          is_read: !nugget.is_read,
        }),
      })

      if (response.ok) {
        onToggleRead(nugget.id, !nugget.is_read)
      }
    } catch (error) {
      console.error('Error toggling read status:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const relevancyColor = getRelevancyColor(nugget.relevancy_score)
  const relevancyLabel = getRelevancyLabel(nugget.relevancy_score)

  // Variable width based on relevancy (higher relevancy = wider card)
  const widthClass = nugget.relevancy_score >= 85 ? 'col-span-2' : 'col-span-1'

  return (
    <article
      className={`
        ${widthClass}
        group relative bg-white border-4 border-black
        transition-all duration-300
        ${nugget.is_read ? 'opacity-40 hover:opacity-60' : 'opacity-100'}
        hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px]
        animate-slide-in
        stagger-${Math.min(index + 1, 6)}
      `}
    >
      {/* Source Favicon - Top left overhang */}
      <SourceFavicon
        url={nugget.link}
        source={nugget.source}
        topic={nugget.topic}
      />

      {/* Relevancy Flag */}
      <div className={`absolute -top-3 -right-3 px-3 py-1 border-2 border-black ${relevancyColor} font-display font-black text-xs z-10`}>
        {relevancyLabel} {nugget.relevancy_score}
      </div>

      {/* Archive Button - Only visible on hover */}
      <button
        onClick={handleToggleRead}
        disabled={isUpdating}
        className={`
          absolute top-4 right-4 px-4 py-2 border-2 border-black
          transition-all opacity-0 group-hover:opacity-100
          ${nugget.is_read ? 'bg-white text-black hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-[hsl(var(--electric-blue))]'}
          ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}
          font-display font-black text-xs z-20
        `}
        title={nugget.is_read ? 'Unarchive' : 'Archive'}
      >
        {nugget.is_read ? '↑ UNARCHIVE' : '↓ ARCHIVE'}
      </button>

      <div className="p-6">
        {/* Title */}
        <h2 className="font-display font-black text-xl md:text-2xl leading-tight mb-3 tracking-tight">
          {nugget.title}
        </h2>

        {/* Description */}
        <p className="font-serif text-base leading-relaxed mb-4 text-foreground/90">
          {nugget.description}
        </p>

        {/* Content (expandable) */}
        {nugget.content && (
          <div className="mb-4">
            <div className={`font-serif text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
              {nugget.content}
            </div>
            {nugget.content.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm font-display font-bold hover:underline"
              >
                {isExpanded ? '← LESS' : 'MORE →'}
              </button>
            )}
          </div>
        )}

        {/* Link - Only visible on hover */}
        {nugget.link && (
          <a
            href={nugget.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mb-4 px-4 py-2 bg-black text-white border-2 border-black hover:bg-[hsl(var(--electric-blue))] transition-all font-serif text-sm opacity-0 group-hover:opacity-100"
          >
            View Source →
          </a>
        )}

        {/* Tags - Only visible on hover */}
        <div className="flex flex-wrap gap-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {nugget.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-black text-white text-xs font-serif border border-black"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Metadata Footer - Only visible on hover */}
        <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-serif text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{nugget.source}</span>
          <span>{new Date(nugget.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </article>
  )
}
