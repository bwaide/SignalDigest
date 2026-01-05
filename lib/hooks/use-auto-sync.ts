'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AutoSyncManager } from '@/lib/auto-sync'

interface UseAutoSyncOptions {
  enabled: boolean
  intervalMinutes: number
  onSync: () => Promise<void>
}

export function useAutoSync({ enabled, intervalMinutes, onSync }: UseAutoSyncOptions) {
  const managerRef = useRef<AutoSyncManager | null>(null)

  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new AutoSyncManager(intervalMinutes)
    }
  }, [intervalMinutes])

  useEffect(() => {
    if (!managerRef.current) return

    if (enabled) {
      managerRef.current.start(onSync)
    } else {
      managerRef.current.stop()
    }

    return () => {
      managerRef.current?.stop()
    }
  }, [enabled, onSync])

  const updateInterval = useCallback((newIntervalMinutes: number) => {
    if (managerRef.current) {
      const wasRunning = managerRef.current.getStatus().isRunning
      managerRef.current.updateInterval(newIntervalMinutes)

      if (wasRunning) {
        managerRef.current.start(onSync)
      }
    }
  }, [onSync])

  const getStatus = useCallback(() => {
    return managerRef.current?.getStatus() || { isRunning: false, intervalMinutes: 0 }
  }, [])

  return {
    updateInterval,
    getStatus
  }
}
