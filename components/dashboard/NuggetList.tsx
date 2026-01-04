'use client'

import { useState } from 'react'

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

interface NuggetListProps {
  nuggets: Nugget[]
  onNuggetUpdate?: (nuggetId: string, isRead: boolean) => void
}

export function NuggetList({ nuggets, onNuggetUpdate }: NuggetListProps) {
  const [updatingNuggets, setUpdatingNuggets] = useState<Set<string>>(new Set())

  const handleToggleRead = async (nuggetId: string, currentIsRead: boolean) => {
    const newIsRead = !currentIsRead

    // Optimistic update
    setUpdatingNuggets((prev) => new Set(prev).add(nuggetId))

    try {
      const response = await fetch('/api/nuggets/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nugget_id: nuggetId,
          is_read: newIsRead,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update nugget')
      }

      // Notify parent component
      onNuggetUpdate?.(nuggetId, newIsRead)
    } catch (error) {
      console.error('Error updating nugget:', error)
    } finally {
      setUpdatingNuggets((prev) => {
        const next = new Set(prev)
        next.delete(nuggetId)
        return next
      })
    }
  }

  if (nuggets.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="text-lg text-muted-foreground">No nuggets yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Import emails and process them to see insights here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {nuggets.map((nugget) => {
        const isUpdating = updatingNuggets.has(nugget.id)
        return (
          <div
            key={nugget.id}
            className={`rounded-lg border bg-white p-6 hover:border-primary hover:shadow-sm transition-all ${
              nugget.is_read ? 'opacity-70' : ''
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nugget.is_read}
                    onChange={() => handleToggleRead(nugget.id, nugget.is_read)}
                    disabled={isUpdating}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    title={nugget.is_read ? 'Mark as unread' : 'Mark as read'}
                  />
                </label>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {nugget.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {nugget.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Relevancy
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {nugget.relevancy_score}%
                  </span>
                </div>
              </div>
            </div>

          {/* Content */}
          {nugget.content && (
            <p className="mt-3 text-sm text-muted-foreground">
              {nugget.content}
            </p>
          )}

          {/* Link */}
          {nugget.link && (
            <a
              href={nugget.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View source →
            </a>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>From: {nugget.source}</span>
              <span>•</span>
              <span>
                {new Date(nugget.published_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {nugget.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
