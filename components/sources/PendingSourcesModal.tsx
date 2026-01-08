'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface Source {
  id: string
  display_name: string
  identifier: string
  extraction_strategy_id: string
  status: string
  created_at: string
}

export function PendingSourcesModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: pendingSources, isLoading } = useQuery({
    queryKey: ['sources', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/sources/list?status=pending')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      return data.sources
    },
    enabled: isOpen
  })

  const acceptMutation = useMutation({
    mutationFn: async ({ sourceId, strategyId }: { sourceId: string; strategyId: string }) => {
      const res = await fetch('/api/sources/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, extraction_strategy_id: strategyId })
      })
      if (!res.ok) throw new Error('Accept failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await fetch('/api/sources/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId })
      })
      if (!res.ok) throw new Error('Reject failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
  })

  if (!isOpen || isLoading) return null
  if (!pendingSources || pendingSources.length === 0) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white border-4 border-black max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black sticky top-0 bg-white">
          <h2 className="font-display font-black text-2xl">NEW SOURCES DETECTED</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm">
            You have {pendingSources.length} new newsletter source{pendingSources.length > 1 ? 's' : ''}:
          </p>

          {pendingSources.map((source: Source) => (
            <PendingSourceCard
              key={source.id}
              source={source}
              onAccept={(strategyId) => acceptMutation.mutate({ sourceId: source.id, strategyId })}
              onReject={() => rejectMutation.mutate(source.id)}
              isProcessing={acceptMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-black text-center sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-black font-display font-black hover:bg-black hover:text-white transition-colors"
          >
            REVIEW LATER
          </button>
        </div>
      </div>
    </div>
  )
}

function PendingSourceCard({
  source,
  onAccept,
  onReject,
  isProcessing
}: {
  source: Source
  onAccept: (strategyId: string) => void
  onReject: () => void
  isProcessing: boolean
}) {
  const [strategy, setStrategy] = useState('generic')

  const formatTimestamp = (timestamp: string) => {
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
    <div className="border-2 border-black p-4 space-y-4">
      <div>
        <h3 className="font-display font-black text-lg">{source.display_name}</h3>
        <p className="text-sm text-gray-600">{source.identifier}</p>
        <p className="text-xs text-gray-500 mt-1">
          First seen: {formatTimestamp(source.created_at)}
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold mb-2">Strategy:</label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          disabled={isProcessing}
          className="w-full px-4 py-2 border-2 border-black bg-white disabled:opacity-50"
        >
          <option value="generic">Generic</option>
          <option value="ad-heavy-link-listing">Ad-Heavy Link Listing</option>
          <option value="long-form-deep-dive">Long-form Deep Dive</option>
          <option value="news-digest">News Digest</option>
        </select>
        <p className="text-xs mt-2 text-gray-600">
          Choose extraction strategy (used in Phase 2)
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(strategy)}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 bg-[hsl(var(--electric-blue))] text-white border-2 border-black font-display font-black hover:bg-black transition-colors disabled:opacity-50"
        >
          ACCEPT
        </button>
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 bg-white border-2 border-black font-display font-black hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
        >
          REJECT
        </button>
      </div>
    </div>
  )
}
