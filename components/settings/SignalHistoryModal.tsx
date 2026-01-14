'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Signal {
  id: string
  title: string
  received_date: string
  status: 'pending' | 'processed' | 'failed'
  error_message: string | null
  nugget_count: number
}

interface SignalHistoryModalProps {
  sourceId: string
  sourceName: string
  isOpen: boolean
  onClose: () => void
}

export function SignalHistoryModal({
  sourceId,
  sourceName,
  isOpen,
  onClose,
}: SignalHistoryModalProps) {
  const queryClient = useQueryClient()
  const [signals, setSignals] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const LIMIT = 10

  const fetchSignals = async (newOffset: number, append: boolean = false) => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/sources/${sourceId}/signals?limit=${LIMIT}&offset=${newOffset}`
      )
      if (!res.ok) throw new Error('Failed to fetch signals')
      const data = await res.json()

      if (append) {
        setSignals((prev) => [...prev, ...data.signals])
      } else {
        setSignals(data.signals)
      }
      setTotal(data.total)
      setHasMore(data.hasMore)
      setOffset(newOffset)
    } catch (error) {
      console.error('Failed to fetch signals:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSignals([])
      setOffset(0)
      setExpandedErrors(new Set())
      fetchSignals(0)
    }
  }, [isOpen, sourceId])

  const reprocessMutation = useMutation({
    mutationFn: async (signalId: string) => {
      const res = await fetch('/api/signals/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Reprocessing failed')
      }
      return res.json()
    },
    onSuccess: () => {
      // Refresh the signals list
      fetchSignals(0)
      // Also invalidate sources to update last_signal_at
      queryClient.invalidateQueries({ queryKey: ['sources'] })
    },
  })

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  const toggleError = (signalId: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(signalId)) {
        next.delete(signalId)
      } else {
        next.add(signalId)
      }
      return next
    })
  }

  const getStatusBadge = (status: Signal['status']) => {
    switch (status) {
      case 'processed':
        return (
          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold">
            ✓ Processed
          </span>
        )
      case 'pending':
        return (
          <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold">
            ⏳ Pending
          </span>
        )
      case 'failed':
        return (
          <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold">
            ✗ Failed
          </span>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white border-2 border-black w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h2 className="font-display font-black text-xl">
            Signal History: {sourceName}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && signals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : signals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No signals from this source yet.
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="border-2 border-black p-3"
                >
                  {/* Title and status row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm flex-1 line-clamp-2">
                      {signal.title}
                    </h3>
                    {getStatusBadge(signal.status)}
                  </div>

                  {/* Info row */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-4">
                      <span>{formatRelativeTime(signal.received_date)}</span>
                      <span className="font-medium">
                        {signal.nugget_count} nugget{signal.nugget_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Reprocess button for pending/failed */}
                    {(signal.status === 'pending' || signal.status === 'failed') && (
                      <button
                        onClick={() => reprocessMutation.mutate(signal.id)}
                        disabled={reprocessMutation.isPending}
                        className="px-3 py-1 text-xs font-bold border-2 border-black hover:bg-[hsl(var(--electric-blue))] hover:text-white transition-colors disabled:opacity-50"
                      >
                        {reprocessMutation.isPending ? '...' : '↻ Reprocess'}
                      </button>
                    )}
                  </div>

                  {/* Error message for failed signals */}
                  {signal.status === 'failed' && signal.error_message && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleError(signal.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {expandedErrors.has(signal.id) ? '▼ Hide error' : '▶ Show error'}
                      </button>
                      {expandedErrors.has(signal.id) && (
                        <div className="mt-1 p-2 bg-red-50 border border-red-200 text-xs text-red-800 font-mono">
                          {signal.error_message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Load more button */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={() => fetchSignals(offset + LIMIT, true)}
                disabled={isLoading}
                className="px-6 py-2 border-2 border-black font-bold hover:bg-black hover:text-white transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : `Load more (${total - signals.length} remaining)`}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-black p-3 text-sm text-gray-500 text-center">
          Showing {signals.length} of {total} signals
        </div>
      </div>
    </div>
  )
}
