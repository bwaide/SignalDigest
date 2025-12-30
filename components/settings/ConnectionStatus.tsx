'use client'

import type { SignalSourceStatus } from '@/types/signal-sources'

interface ConnectionStatusProps {
  status: SignalSourceStatus
  onClick?: () => void
}

const STATUS_CONFIG = {
  not_configured: {
    color: 'bg-gray-400',
    text: 'Email not configured',
  },
  testing: {
    color: 'bg-yellow-400',
    text: 'Testing connection...',
  },
  connected: {
    color: 'bg-green-500',
    text: 'Email connected',
  },
  failed: {
    color: 'bg-red-500',
    text: 'Connection failed',
  },
} as const

export function ConnectionStatus({ status, onClick }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status]
  const isTesting = status === 'testing'

  const content = (
    <>
      <span className={`h-2 w-2 rounded-full ${config.color} ${isTesting ? 'animate-pulse' : ''}`} />
      <span>{config.text}</span>
    </>
  )

  const baseClassName = "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"

  if (!onClick) {
    return (
      <div className={baseClassName} role="status" aria-label={config.text}>
        {content}
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm`}
      aria-label={config.text}
      role="status"
    >
      {content}
    </button>
  )
}
