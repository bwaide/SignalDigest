'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SignalHistoryModal } from './SignalHistoryModal'

interface Source {
  id: string
  display_name: string
  identifier: string
  extraction_strategy_id: string
  status: string
  last_signal_at: string | null
  created_at: string
}

const STRATEGIES = [
  { id: 'generic', label: 'Generic' },
  { id: 'ad-heavy-link-listing', label: 'Ad-Heavy Link Listing' },
  { id: 'long-form-deep-dive', label: 'Long-form Deep Dive' },
  { id: 'news-digest', label: 'News Digest' }
]

export function SourceCard({ source }: { source: Source }) {
  const queryClient = useQueryClient()
  const [strategy, setStrategy] = useState(source.extraction_strategy_id)
  const [showHistory, setShowHistory] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch('/api/sources/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id, ...updates })
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: () => {
      // Invalidate all sources queries regardless of filter/page
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      // Also invalidate pending count for badge
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sources/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id })
      })
      if (!res.ok) throw new Error('Delete failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  const togglePause = () => {
    const newStatus = source.status === 'active' ? 'paused' : 'active'
    updateMutation.mutate({ status: newStatus })
  }

  const acceptSource = () => {
    updateMutation.mutate({ status: 'active' })
  }

  const handleStrategyChange = (newStrategy: string) => {
    setStrategy(newStrategy)
    updateMutation.mutate({ extraction_strategy_id: newStrategy })
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(timestamp))
  }

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-black">
        <h3 className="font-display font-black text-lg">{source.display_name}</h3>
        <div className="flex gap-2">
          {source.status === 'pending' && (
            <button
              onClick={acceptSource}
              disabled={updateMutation.isPending}
              className="px-4 h-10 flex items-center justify-center border-2 border-black bg-[hsl(var(--electric-blue))] text-white hover:bg-[hsl(var(--electric-blue))]/90 transition-colors disabled:opacity-50 font-display font-black text-sm"
              title="Accept source"
            >
              ✓ ACCEPT
            </button>
          )}
          {source.status !== 'pending' && (
            <button
              onClick={togglePause}
              disabled={updateMutation.isPending}
              className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
              title={source.status === 'active' ? 'Pause' : 'Resume'}
            >
              {source.status === 'active' ? '⏸' : '▶'}
            </button>
          )}
          <button
            onClick={() => {
              const action = source.status === 'rejected' ? 'Delete' : 'Reject'
              const message = source.status === 'rejected'
                ? `Permanently delete source "${source.display_name}"? This cannot be undone.`
                : `Reject source "${source.display_name}"? Future emails will be ignored.`
              if (confirm(message)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
            title={source.status === 'rejected' ? 'Delete' : 'Reject'}
          >
            ×
          </button>
        </div>
      </div>

      {/* Identifier */}
      <div className="px-4 py-3 border-b-2 border-black text-sm">
        {source.identifier}
      </div>

      {/* Strategy Selector */}
      <div className="px-4 py-3 border-b-2 border-black">
        <label className="block text-sm font-bold mb-2">Strategy:</label>
        <select
          value={strategy}
          onChange={(e) => handleStrategyChange(e.target.value)}
          disabled={updateMutation.isPending}
          className="w-full px-4 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] disabled:opacity-50"
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timestamp */}
      <div className="px-4 py-3 text-sm flex items-center justify-between">
        <span>
          Last seen: <span className="font-bold">{formatTimestamp(source.last_signal_at)}</span>
          {' · '}
          <button
            onClick={() => setShowHistory(true)}
            className="text-[hsl(var(--electric-blue))] hover:underline font-medium"
          >
            View history →
          </button>
        </span>
        {source.status === 'pending' && (
          <span className="px-3 py-1 bg-yellow-400 text-black font-bold text-xs border border-black">
            PENDING APPROVAL
          </span>
        )}
        {source.status === 'paused' && (
          <span className="px-3 py-1 bg-gray-400 text-white font-bold text-xs border border-black">
            PAUSED
          </span>
        )}
      </div>

      {/* Signal History Modal */}
      <SignalHistoryModal
        sourceId={source.id}
        sourceName={source.display_name}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  )
}
