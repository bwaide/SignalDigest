'use client'

import { useState } from 'react'
import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'

interface CommandBarProps {
  emailStatus?: SignalSourceStatus
  onSearch: (query: string) => void
  unreadOnly: boolean
  onUnreadOnlyChange: (checked: boolean) => void
}

export function CommandBar({ emailStatus = 'not_configured', onSearch, unreadOnly, onUnreadOnlyChange }: CommandBarProps) {
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b-4 border-black">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-black tracking-tight">
              SIGNAL<span className="text-[hsl(var(--electric-blue))]">.</span>
            </h1>
            <ConnectionStatus status={emailStatus} onClick={openSettings} />
          </div>

          {/* Search + Filters */}
          <div className="flex-1 max-w-2xl flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="search"
                placeholder="Search nuggets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-2.5 bg-black text-white placeholder:text-white/60 border-2 border-black focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] font-serif"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    onSearch('')
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 hover:bg-white/20 text-white text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 px-4 py-2.5 bg-black text-white border-2 border-black cursor-pointer hover:bg-white hover:text-black transition-colors">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => onUnreadOnlyChange(e.target.checked)}
                className="w-4 h-4 accent-[hsl(var(--electric-blue))]"
              />
              <span className="text-sm font-serif">Unread</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckNow}
              disabled={emailStatus !== 'connected' || isChecking}
              className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {checkResult || (isChecking ? 'SYNC' : '⚡ SYNC')}
            </button>

            <button
              onClick={openSettings}
              className="px-4 py-2.5 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors font-serif"
            >
              ⚙
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
