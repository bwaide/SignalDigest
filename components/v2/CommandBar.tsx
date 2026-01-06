'use client'

import { useState } from 'react'
import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'

interface CommandBarProps {
  emailStatus?: SignalSourceStatus
  onSearch: (query: string) => void
  showUnreadFilter?: boolean
}

export function CommandBar({ emailStatus = 'not_configured', onSearch, showUnreadFilter = true }: CommandBarProps) {
  const openSettings = useSettingsStore((state) => state.openSettings)
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleCheckNow = async () => {
    if (isChecking) return

    setIsChecking(true)
    setCheckResult(null)

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

      if (imported === 0) {
        setCheckResult('✓ No new')
        setTimeout(() => setCheckResult(null), 3000)
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
      <div className="max-w-screen-2xl mx-auto px-3 md:px-6 py-2 md:py-4">
        {/* Mobile: Two-row layout, Desktop: Single row */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          {/* Row 1 on mobile: Logo + Connection + Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <div className="flex items-center gap-2 md:gap-3">
              <h1 className="text-xl md:text-3xl font-display font-black tracking-tight">
                SIGNAL<span className="text-[hsl(var(--electric-blue))]">.</span>
              </h1>
              <ConnectionStatus status={emailStatus} onClick={openSettings} />
            </div>

            {/* Actions - visible on mobile */}
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={handleCheckNow}
                disabled={emailStatus !== 'connected' || isChecking}
                className="px-3 md:px-6 py-2 md:py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-xs md:text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] md:hover:translate-x-[-4px] md:hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                {checkResult || (isChecking ? 'SYNC' : '⚡ SYNC')}
              </button>

              <button
                onClick={openSettings}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors font-serif text-base md:text-lg"
                aria-label="Settings"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Row 2 on mobile: Search bar */}
          <div className="flex-1 flex items-center gap-2 md:max-w-2xl">
            <div className="relative flex-1">
              <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none text-sm md:text-base">
                🔍
              </span>
              <input
                type="search"
                placeholder="Search nuggets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 md:pl-10 pr-10 md:pr-12 py-2 md:py-2.5 bg-black text-white placeholder:text-white/80 border-2 border-black focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] font-serif text-sm md:text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    onSearch('')
                  }}
                  className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 px-2 py-1 hover:bg-white/20 text-white text-sm md:text-base"
                >
                  ✕
                </button>
              )}
            </div>

            {showUnreadFilter && (
              <label className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-black text-white border-2 border-black cursor-pointer hover:bg-white hover:text-black transition-colors">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => {}}
                  className="w-4 h-4 accent-[hsl(var(--electric-blue))]"
                />
                <span className="text-sm font-serif">Unread</span>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
