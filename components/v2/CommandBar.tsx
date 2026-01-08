'use client'

import { useState } from 'react'
import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { NotificationBadge, NotificationBadgeMobile } from '@/components/sources/NotificationBadge'
import type { SignalSourceStatus } from '@/types/signal-sources'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface CommandBarProps {
  emailStatus?: SignalSourceStatus
  onSearch: (query: string) => void
  showUnreadFilter?: boolean
}

export function CommandBar({ emailStatus = 'not_configured', onSearch, showUnreadFilter = true }: CommandBarProps) {
  const openSettings = useSettingsStore((state) => state.openSettings)
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleCheckNow = async () => {
    if (isChecking) return

    setIsChecking(true)
    setCheckResult(null)
    setMenuOpen(false)

    try {
      setCheckResult('Importing...')
      const importResponse = await fetch('/api/emails/import', {
        method: 'POST',
      })

      const importData = await importResponse.json()

      if (!importResponse.ok || !importData.success) {
        setCheckResult(`✗ Failed`)
        return
      }

      const imported = importData.imported || 0
      const newPendingSources = importData.newPendingSources || 0

      if (imported === 0 && newPendingSources === 0) {
        setCheckResult('✓ No new')
        setTimeout(() => setCheckResult(null), 3000)
        return
      }

      if (imported === 0 && newPendingSources > 0) {
        setCheckResult(`✓ ${newPendingSources} new source(s) pending approval`)
        // Invalidate pending count query to update badge immediately
        await queryClient.refetchQueries({ queryKey: ['pending-count'] })
        setTimeout(() => {
          setCheckResult(null)
          // Navigate to settings with pending sources filter
          router.push('/settings?tab=sources&filter=pending')
        }, 2000)
        return
      }

      setCheckResult(`Processing...`)
      const processResponse = await fetch('/api/signals/process', {
        method: 'POST',
      })

      const processData = await processResponse.json()

      if (processResponse.ok && processData.success) {
        setCheckResult(`✓ +${processData.processed}`)
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setCheckResult(`⚠ Check failed`)
      }
    } catch {
      setCheckResult('✗ Error')
    } finally {
      setIsChecking(false)
      setTimeout(() => setCheckResult(null), 5000)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch(value)
  }

  const toggleSearch = () => {
    setSearchExpanded(!searchExpanded)
    if (!searchExpanded) {
      setTimeout(() => {
        document.getElementById('search-input')?.focus()
      }, 100)
    } else {
      setSearchQuery('')
      onSearch('')
    }
  }

  const handleSettingsClick = () => {
    setMenuOpen(false)
    openSettings()
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo + Status */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight">
              SIGNAL<span className="text-[hsl(var(--electric-blue))]">.</span>
            </h1>
            <ConnectionStatus status={emailStatus} onClick={handleSettingsClick} />
          </div>

          {/* Desktop: Search + Actions */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none">
                🔍
              </span>
              <input
                type="search"
                placeholder="Search nuggets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-12 py-2.5 bg-black text-white placeholder:text-white/80 border-2 border-black focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] font-serif text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    onSearch('')
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleCheckNow}
              disabled={emailStatus !== 'connected' || isChecking}
              className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0 whitespace-nowrap"
            >
              {checkResult || (isChecking ? 'SYNCING...' : '⚡ SYNC')}
            </button>

            <NotificationBadge />
          </div>

          {/* Mobile: Search Icon + Burger Menu */}
          <div className="flex md:hidden items-center gap-2">
            {/* Search Toggle */}
            <button
              onClick={toggleSearch}
              className={`w-10 h-10 flex items-center justify-center border-2 border-black transition-all ${
                searchExpanded ? 'bg-black text-white' : 'bg-white hover:bg-black hover:text-white'
              }`}
              aria-label="Search"
            >
              <span className="text-base">{searchExpanded ? '✕' : '🔍'}</span>
            </button>

            {/* Burger Menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black hover:bg-black hover:text-white transition-colors"
              aria-label="Menu"
            >
              <div className="w-4 h-3.5 flex flex-col justify-between">
                <span className="block h-0.5 bg-current"></span>
                <span className="block h-0.5 bg-current"></span>
                <span className="block h-0.5 bg-current"></span>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Search Expanded */}
        {searchExpanded && (
          <div className="md:hidden mt-3 animate-slide-in">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none">
                🔍
              </span>
              <input
                id="search-input"
                type="search"
                placeholder="Search nuggets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-10 py-2.5 bg-black text-white placeholder:text-white/80 border-2 border-black focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] font-serif text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    onSearch('')
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Menu Dropdown */}
        {menuOpen && (
          <div className="md:hidden mt-3 border-2 border-black bg-white animate-slide-in">
            <button
              onClick={handleCheckNow}
              disabled={emailStatus !== 'connected' || isChecking}
              className="w-full px-4 py-3 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-b-2 border-black disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              {checkResult || (isChecking ? 'SYNCING...' : '⚡ SYNC NOW')}
            </button>
            <NotificationBadgeMobile />
          </div>
        )}
      </div>
    </div>
  )
}
