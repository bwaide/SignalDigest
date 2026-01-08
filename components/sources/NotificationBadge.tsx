'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

export function NotificationBadge() {
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const res = await fetch('/api/sources/pending-count')
      if (!res.ok) return { count: 0 }
      return res.json()
    },
    refetchInterval: 900000, // 15 minutes (matches auto-sync)
    staleTime: 900000
  })

  const count = data?.count || 0

  const handleClick = () => {
    router.push('/settings?tab=sources&filter=pending')
  }

  if (count === 0) {
    // No badge, just settings button
    return (
      <button
        onClick={handleClick}
        className="px-4 py-2.5 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors font-serif text-lg"
        aria-label="Settings"
      >
        ⚙
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="relative px-4 py-2.5 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors font-serif text-lg"
      aria-label={`Settings (${count} pending sources)`}
    >
      ⚙
      <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-black">
        {count}
      </span>
    </button>
  )
}

export function NotificationBadgeMobile() {
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const res = await fetch('/api/sources/pending-count')
      if (!res.ok) return { count: 0 }
      return res.json()
    },
    refetchInterval: 900000,
    staleTime: 900000
  })

  const count = data?.count || 0

  const handleClick = () => {
    router.push('/settings?tab=sources&filter=pending')
  }

  return (
    <button
      onClick={handleClick}
      className="w-full px-4 py-3 bg-white hover:bg-black hover:text-white transition-colors font-display font-black text-sm text-left flex items-center gap-2 relative"
    >
      <span className="text-base">⚙</span>
      SETTINGS
      {count > 0 && (
        <span className="ml-auto min-w-6 h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-black">
          {count}
        </span>
      )}
    </button>
  )
}
