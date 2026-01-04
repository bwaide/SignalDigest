'use client'

import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'
import { useState } from 'react'

interface HeaderProps {
  emailStatus?: SignalSourceStatus
}

export function Header({ emailStatus = 'not_configured' }: HeaderProps) {
  const openSettings = useSettingsStore((state) => state.openSettings)
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const handleCheckNow = async () => {
    if (isChecking) return

    setIsChecking(true)
    setCheckResult(null)

    try {
      // Step 1: Import emails
      setCheckResult('Importing emails...')
      const importResponse = await fetch('/api/emails/import', {
        method: 'POST',
      })

      const importData = await importResponse.json()

      if (!importResponse.ok || !importData.success) {
        setCheckResult(`✗ Import failed: ${importData.error}`)
        return
      }

      const imported = importData.imported || 0

      if (imported === 0) {
        setCheckResult('✓ No new emails')
        setTimeout(() => {
          setCheckResult(null)
        }, 3000)
        return
      }

      // Step 2: Process signals to extract nuggets
      setCheckResult(`Processing ${imported} email(s)...`)
      const processResponse = await fetch('/api/signals/process', {
        method: 'POST',
      })

      const processData = await processResponse.json()

      if (processResponse.ok && processData.success) {
        setCheckResult(`✓ Imported ${imported}, extracted ${processData.processed} nuggets`)

        // Reload page after 2 seconds to show new nuggets
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setCheckResult(`⚠ Imported ${imported}, but processing failed`)
      }
    } catch {
      setCheckResult('✗ Network error')
    } finally {
      setIsChecking(false)

      // Clear result after 5 seconds
      setTimeout(() => {
        setCheckResult(null)
      }, 5000)
    }
  }

  const isCheckDisabled = emailStatus !== 'connected' || isChecking

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">Signal Digest</h1>
          <ConnectionStatus status={emailStatus} onClick={openSettings} />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCheckNow}
            disabled={isCheckDisabled}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkResult || (isChecking ? 'Checking...' : '🔄 Check Now')}
          </button>
          <button
            onClick={openSettings}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    </header>
  )
}
