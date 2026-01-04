'use client'

import { useState, useEffect } from 'react'

interface Signal {
  id: string
  title: string
  source_identifier: string
  received_date: string
  status: 'pending' | 'processed' | 'failed'
  nugget_count: number
  created_at: string
}

export function SignalsList() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchSignals = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/signals/list')
      const data = await response.json()

      if (response.ok && data.success) {
        setSignals(data.signals)
        setError(null)
      } else {
        setError(data.error || 'Failed to load signals')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleReanalyze = async (signalId: string) => {
    if (reanalyzing) return

    setReanalyzing(signalId)

    try {
      const response = await fetch('/api/signals/reanalyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signal_id: signalId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Refresh the signals list
        await fetchSignals()
      } else {
        setError(data.error || 'Failed to re-analyze signal')
      }
    } catch {
      setError('Network error')
    } finally {
      setReanalyzing(null)
    }
  }

  const handleDelete = async (signalId: string) => {
    if (deleting || !confirm('Delete this signal and all its nuggets? This cannot be undone.')) return

    setDeleting(signalId)

    try {
      const response = await fetch('/api/signals/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signal_id: signalId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Refresh the signals list
        await fetchSignals()
      } else {
        setError(data.error || 'Failed to delete signal')
      }
    } catch {
      setError('Network error')
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    fetchSignals()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading signals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={fetchSignals}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No signals imported yet. Use the &quot;Check Now&quot; button to import emails.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {signals.length} signal{signals.length !== 1 ? 's' : ''} imported
        </p>
        <button
          onClick={fetchSignals}
          className="text-sm text-primary hover:underline"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-2">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-lg border bg-white p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate" title={signal.title}>
                  {signal.title}
                </h4>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{signal.source_identifier}</span>
                  <span>•</span>
                  <span>{new Date(signal.received_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      signal.status === 'processed'
                        ? 'bg-green-100 text-green-700'
                        : signal.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {signal.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {signal.nugget_count} nugget{signal.nugget_count !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReanalyze(signal.id)}
                    disabled={reanalyzing === signal.id || deleting === signal.id}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete existing nuggets and re-extract from this email"
                  >
                    {reanalyzing === signal.id ? '⏳' : '🔄'} Re-analyze
                  </button>

                  <button
                    onClick={() => handleDelete(signal.id)}
                    disabled={deleting === signal.id || reanalyzing === signal.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete this signal and all its nuggets"
                  >
                    {deleting === signal.id ? '⏳' : '🗑️'} Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
