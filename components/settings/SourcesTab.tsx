'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SourceCard } from './SourceCard'

type SourceStatus = 'all' | 'active' | 'pending' | 'paused' | 'rejected'

interface Source {
  id: string
  display_name: string
  identifier: string
  extraction_strategy_id: string
  status: string
  last_signal_at: string | null
  created_at: string
}

export function SourcesTab() {
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter') as SourceStatus | null
  const [status, setStatus] = useState<SourceStatus>(filterParam || 'all')
  const [page, setPage] = useState(1)
  const limit = 25

  // Update status when URL parameter changes
  useEffect(() => {
    if (filterParam && filterParam !== status) {
      setStatus(filterParam)
    }
  }, [filterParam])

  const { data, isLoading, error } = useQuery({
    queryKey: ['sources', status, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      if (status !== 'all') {
        params.set('status', status)
      }

      const res = await fetch(`/api/sources/list?${params}`)
      if (!res.ok) throw new Error('Failed to fetch sources')
      return res.json()
    }
  })

  if (error) {
    return (
      <div className="p-8 border-2 border-black text-center">
        <p className="font-display font-black text-lg text-red-500">ERROR LOADING SOURCES</p>
        <p className="text-sm mt-2">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'pending', 'paused', 'rejected'] as SourceStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={`px-4 py-2 border-2 border-black font-display font-black text-sm transition-colors ${
              status === s
                ? 'bg-[hsl(var(--electric-blue))] text-white'
                : 'bg-white hover:bg-black hover:text-white'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Sources List */}
      {isLoading ? (
        <div className="text-center py-12 border-2 border-black p-8">
          <p className="font-display font-black text-lg">LOADING SOURCES...</p>
        </div>
      ) : data?.sources.length === 0 ? (
        <div className="text-center py-12 border-2 border-black p-8">
          <p className="font-display font-black text-lg">NO SOURCES YET</p>
          <p className="text-sm mt-2">Sources will appear here when emails are imported</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.sources.map((source: Source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!data.pagination.hasPrev}
              className="px-6 py-2 border-2 border-black font-display font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              ◄ PREV
            </button>

            <div className="flex gap-2">
              {Array.from({ length: Math.min(data.pagination.totalPages, 10) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 border-2 border-black font-display font-black ${
                    p === page
                      ? 'bg-[hsl(var(--electric-blue))] text-white'
                      : 'bg-white hover:bg-black hover:text-white'
                  } transition-colors`}
                >
                  {p}
                </button>
              ))}
              {data.pagination.totalPages > 10 && (
                <span className="flex items-center px-2">...</span>
              )}
            </div>

            <button
              onClick={() => setPage(page + 1)}
              disabled={!data.pagination.hasNext}
              className="px-6 py-2 border-2 border-black font-display font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              NEXT ►
            </button>
          </div>

          <div className="text-center text-sm text-gray-600">
            Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, data?.pagination.total || 0)} of {data?.pagination.total || 0} sources
          </div>
        </div>
      )}
    </div>
  )
}
