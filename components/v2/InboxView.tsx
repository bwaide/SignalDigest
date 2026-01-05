'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { SourceFavicon } from './SourceFavicon'

type NuggetStatus = 'unread' | 'archived' | 'saved'

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
  status: NuggetStatus
}

interface InboxViewProps {
  nuggets: Nugget[]
  onUpdateStatus: (id: string, status: NuggetStatus) => void
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

export function InboxView({ nuggets, onUpdateStatus }: InboxViewProps) {
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState(false)

  // Filter out processed nuggets
  const activeNuggets = useMemo(
    () => nuggets.filter(n => !processedIds.has(n.id)),
    [nuggets, processedIds]
  )

  const currentNugget = activeNuggets[0]

  // Reset processed IDs when nuggets list changes externally
  useEffect(() => {
    setProcessedIds(new Set())
  }, [nuggets.length])

  const handleAction = useCallback(async (action: 'archive' | 'save' | 'skip') => {
    if (!currentNugget || isUpdating) return

    if (action === 'skip') {
      // Mark as processed temporarily so we skip to next
      setProcessedIds(prev => new Set(prev).add(currentNugget.id))
      return
    }

    setIsUpdating(true)
    try {
      const newStatus = action === 'archive' ? 'archived' : 'saved'
      const response = await fetch('/api/nuggets/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nugget_id: currentNugget.id,
          status: newStatus,
        }),
      })

      if (response.ok) {
        onUpdateStatus(currentNugget.id, newStatus)
        // Mark as processed so it's removed from active list
        setProcessedIds(prev => new Set(prev).add(currentNugget.id))
      }
    } catch (error) {
      console.error('Error updating nugget status:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [currentNugget, isUpdating, onUpdateStatus])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isUpdating || !currentNugget) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleAction('archive')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleAction('save')
      } else if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        handleAction('skip')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleAction, isUpdating, currentNugget])

  if (!currentNugget) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-display font-black text-4xl mb-4 tracking-tight">
            INBOX ZERO!
          </h2>
          <p className="font-serif text-lg text-foreground/60">
            You&apos;ve processed all your nuggets. Check back later for more insights.
          </p>
        </div>
      </div>
    )
  }

  const relevancyColor = getRelevancyColor(currentNugget.relevancy_score)
  const relevancyLabel = getRelevancyLabel(currentNugget.relevancy_score)

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-12">
      {/* Progress indicator */}
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display font-bold text-sm">
            {nuggets.length - activeNuggets.length + 1} of {nuggets.length}
          </span>
          <span className="font-serif text-sm text-foreground/60">
            {activeNuggets.length - 1} remaining
          </span>
        </div>
        <div className="w-full h-2 bg-black/10 border-2 border-black">
          <div
            className="h-full bg-[hsl(var(--electric-blue))] transition-all duration-300"
            style={{ width: `${((nuggets.length - activeNuggets.length + 1) / nuggets.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-3xl bg-white border-4 border-black shadow-brutal relative">
        {/* Source Favicon */}
        <SourceFavicon
          url={currentNugget.link}
          source={currentNugget.source}
          topic={currentNugget.topic}
        />

        {/* Relevancy Flag */}
        <div className={`absolute -top-3 -right-3 px-3 py-1 border-2 border-black ${relevancyColor} font-display font-black text-xs z-10`}>
          {relevancyLabel} {currentNugget.relevancy_score}
        </div>

        <div className="p-8">
          {/* Title */}
          <h1 className="font-display font-black text-3xl md:text-4xl leading-tight mb-4 tracking-tight">
            {currentNugget.title}
          </h1>

          {/* Description */}
          <p className="font-serif text-lg leading-relaxed mb-6 text-foreground/90">
            {currentNugget.description}
          </p>

          {/* Content */}
          {currentNugget.content && (
            <div className="mb-6 p-4 bg-black/5 border-l-4 border-black">
              <p className="font-serif text-base leading-relaxed whitespace-pre-wrap">
                {currentNugget.content}
              </p>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-black text-white text-xs font-display font-bold border border-black">
              {currentNugget.topic}
            </span>
            {currentNugget.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-white text-black text-xs font-serif border border-black"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Link */}
          {currentNugget.link && (
            <a
              href={currentNugget.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-6 px-4 py-2 bg-black text-white border-2 border-black hover:bg-[hsl(var(--electric-blue))] transition-all font-serif text-sm"
            >
              View Source →
            </a>
          )}

          {/* Metadata Footer */}
          <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-serif text-foreground/60">
            <span>{currentNugget.source}</span>
            <span>{new Date(currentNugget.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-3xl mt-8 flex items-center justify-center gap-4">
        <button
          onClick={() => handleAction('archive')}
          disabled={isUpdating}
          className={`flex-1 max-w-xs px-8 py-4 border-4 border-black bg-black text-white hover:bg-[hsl(var(--cyber-pink))] transition-all font-display font-black text-lg ${isUpdating ? 'cursor-wait opacity-50' : ''}`}
        >
          ← ARCHIVE
        </button>

        <button
          onClick={() => handleAction('skip')}
          disabled={isUpdating}
          className={`px-6 py-4 border-4 border-black bg-white text-black hover:bg-black hover:text-white transition-all font-display font-black ${isUpdating ? 'cursor-wait opacity-50' : ''}`}
        >
          SKIP ↓
        </button>

        <button
          onClick={() => handleAction('save')}
          disabled={isUpdating}
          className={`flex-1 max-w-xs px-8 py-4 border-4 border-black bg-[hsl(var(--neon-green))] text-black hover:bg-[hsl(var(--electric-blue))] hover:text-white transition-all font-display font-black text-lg ${isUpdating ? 'cursor-wait opacity-50' : ''}`}
        >
          SAVE →
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-6 text-center font-serif text-sm text-foreground/60">
        <span className="font-mono bg-black/5 px-2 py-1 border border-black/20">←</span> Archive ·
        <span className="font-mono bg-black/5 px-2 py-1 border border-black/20 ml-2">↓</span> Skip ·
        <span className="font-mono bg-black/5 px-2 py-1 border border-black/20 ml-2">→</span> Save
      </div>
    </div>
  )
}
