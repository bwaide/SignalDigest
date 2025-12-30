'use client'

import { ConnectionStatus } from '@/components/settings/ConnectionStatus'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'

interface HeaderProps {
  emailStatus?: SignalSourceStatus
}

export function Header({ emailStatus = 'not_configured' }: HeaderProps) {
  const openSettings = useSettingsStore((state) => state.openSettings)

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">Signal Digest</h1>
          <ConnectionStatus status={emailStatus} onClick={openSettings} />
        </div>
        <div className="flex items-center gap-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled
          >
            🔄 Check Now
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
