'use client'

import { useState } from 'react'
import { SourceFavicon } from './SourceFavicon'

type NuggetStatus = 'unread' | 'archived' | 'saved'

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
    status: NuggetStatus
  }
  onUpdateStatus: (id: string, status: NuggetStatus) => void
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

export function NuggetCard({ nugget, onUpdateStatus, index }: NuggetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateStatus = async (newStatus: NuggetStatus) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/nuggets/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nugget_id: nugget.id,
          status: newStatus,
        }),
      })

      if (response.ok) {
        onUpdateStatus(nugget.id, newStatus)
      }
    } catch (error) {
      console.error('Error updating nugget status:', error)
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
        group relative bg-white border-4
        ${nugget.status === 'saved' ? 'border-[hsl(var(--neon-green))]' : 'border-black'}
        transition-all duration-300
        opacity-100
        md:hover:shadow-brutal md:hover:translate-x-[-4px] md:hover:translate-y-[-4px]
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
      <div className={`absolute -top-2 md:-top-3 -right-2 md:-right-3 px-2 md:px-3 py-0.5 md:py-1 border-2 border-black ${relevancyColor} font-display font-black text-[10px] md:text-xs z-10`}>
        {relevancyLabel} {nugget.relevancy_score}
      </div>

      {/* Mobile Swipe Indicator - Always visible on mobile */}
      <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-black/40 font-display font-black">
        <span>←</span>
        <span>SWIPE</span>
        <span>→</span>
      </div>

      {/* Action Buttons - Always visible on mobile, hover on desktop */}
      <div className="absolute top-3 md:top-4 right-2 md:right-4 flex gap-1 md:gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
        {nugget.status === 'unread' && (
          <>
            <button
              onClick={() => handleUpdateStatus('archived')}
              disabled={isUpdating}
              className={`px-2 md:px-3 py-1.5 md:py-2 border-2 border-black bg-black text-white hover:bg-[hsl(var(--cyber-pink))] font-display font-black text-[10px] md:text-xs ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
              title="Archive this nugget"
            >
              ↓ ARCHIVE
            </button>
            <button
              onClick={() => handleUpdateStatus('saved')}
              disabled={isUpdating}
              className={`px-2 md:px-3 py-1.5 md:py-2 border-2 border-black bg-[hsl(var(--neon-green))] text-black hover:bg-[hsl(var(--electric-blue))] hover:text-white font-display font-black text-[10px] md:text-xs ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
              title="Save this nugget"
            >
              ★ SAVE
            </button>
          </>
        )}
        {nugget.status === 'saved' && (
          <>
            <button
              onClick={() => handleUpdateStatus('archived')}
              disabled={isUpdating}
              className={`px-2 md:px-3 py-1.5 md:py-2 border-2 border-black bg-black text-white hover:bg-[hsl(var(--cyber-pink))] font-display font-black text-[10px] md:text-xs ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
              title="Archive this nugget"
            >
              ↓ ARCHIVE
            </button>
            <button
              onClick={() => handleUpdateStatus('unread')}
              disabled={isUpdating}
              className={`px-2 md:px-3 py-1.5 md:py-2 border-2 border-black bg-white text-black hover:bg-[hsl(var(--electric-blue))] hover:text-white font-display font-black text-[10px] md:text-xs ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
              title="Mark as unread"
            >
              ↑ UNREAD
            </button>
          </>
        )}
      </div>

      <div className="p-4 md:p-6">
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

        {/* Link - Always visible on mobile, hover on desktop */}
        {nugget.link && (
          <a
            href={nugget.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mb-4 px-3 md:px-4 py-1.5 md:py-2 bg-black text-white border-2 border-black hover:bg-[hsl(var(--electric-blue))] transition-all font-serif text-xs md:text-sm md:opacity-0 md:group-hover:opacity-100"
          >
            View Source →
          </a>
        )}

        {/* Tags - Always visible on mobile, hover on desktop */}
        <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {nugget.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 md:py-1 bg-black text-white text-[10px] md:text-xs font-serif border border-black"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Metadata Footer - Always visible on mobile, hover on desktop */}
        <div className="pt-3 md:pt-4 border-t-2 border-black/10 flex items-center justify-between text-[10px] md:text-xs font-serif text-foreground/60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <span>{nugget.source}</span>
          <span>{new Date(nugget.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </article>
  )
}
