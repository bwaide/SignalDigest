'use client'

import { useState } from 'react'

type NuggetStatus = 'unread' | 'archived' | 'saved'

interface Nugget {
  id: string
  title: string
  description: string
  source: string
  published_date: string
  relevancy_score: number
  topic: string
  status: NuggetStatus
}

interface ArchiveViewProps {
  nuggets: Nugget[]
  onUpdateStatus: (id: string, status: NuggetStatus) => void
}

export function ArchiveView({ nuggets, onUpdateStatus }: ArchiveViewProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    try {
      // Delete all archived nuggets by updating them to a deleted status
      // Or we could create a bulk delete endpoint
      const deletePromises = nuggets.map(nugget =>
        fetch('/api/nuggets/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nugget_id: nugget.id }),
        })
      )

      await Promise.all(deletePromises)

      // Refresh the page to show updated list
      window.location.reload()
    } catch (error) {
      console.error('Error deleting archived nuggets:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleRestore = async (nuggetId: string) => {
    try {
      const response = await fetch('/api/nuggets/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nugget_id: nuggetId,
          status: 'unread',
        }),
      })

      if (response.ok) {
        onUpdateStatus(nuggetId, 'unread')
      }
    } catch (error) {
      console.error('Error restoring nugget:', error)
    }
  }

  if (nuggets.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h3 className="font-display font-black text-4xl mb-4 tracking-tight">
            NO ARCHIVED ITEMS
          </h3>
          <p className="font-serif text-lg text-foreground/60">
            Archived nuggets will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header with bulk actions */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tighter mb-2">
            ARCHIVE
          </h2>
          <p className="font-serif text-lg text-foreground/60">
            {nuggets.length} archived item{nuggets.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          className="px-6 py-3 border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-all font-display font-black text-sm"
        >
          DELETE ALL
        </button>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black shadow-brutal max-w-md w-full p-6">
            <h3 className="font-display font-black text-2xl mb-4">
              DELETE ALL ARCHIVED ITEMS?
            </h3>
            <p className="font-serif mb-6">
              This will permanently delete {nuggets.length} archived nugget{nuggets.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-all font-display font-black"
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 border-2 border-black bg-black text-white hover:bg-[hsl(var(--cyber-pink))] transition-all font-display font-black"
              >
                {isDeleting ? 'DELETING...' : 'DELETE ALL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dense list */}
      <div className="border-4 border-black bg-white">
        {nuggets.map((nugget, index) => (
          <div
            key={nugget.id}
            className={`p-4 hover:bg-black/5 transition-colors ${index !== 0 ? 'border-t-2 border-black/10' : ''}`}
          >
            <div className="flex items-start gap-4">
              {/* Topic badge */}
              <div className="flex-shrink-0">
                <span className="inline-block px-2 py-1 bg-black text-white text-xs font-display font-bold">
                  {nugget.topic}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-lg leading-tight mb-1">
                  {nugget.title}
                </h3>
                <p className="font-serif text-sm text-foreground/70 line-clamp-2 mb-2">
                  {nugget.description}
                </p>
                <div className="flex items-center gap-4 text-xs font-serif text-foreground/60">
                  <span>{nugget.source}</span>
                  <span>•</span>
                  <span>{new Date(nugget.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>•</span>
                  <span>Relevancy: {nugget.relevancy_score}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleRestore(nugget.id)}
                  className="px-3 py-2 border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-all font-display font-black text-xs"
                  title="Restore to Inbox"
                >
                  ↑ RESTORE
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
