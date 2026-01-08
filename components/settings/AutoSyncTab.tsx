'use client'

import { useState, useEffect } from 'react'

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
]

export function AutoSyncTab() {
  const [enabled, setEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(30)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/load-auto-sync')
      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('Error loading auto-sync settings:', data.error)
        return
      }

      setEnabled(data.settings.enabled)
      setIntervalMinutes(data.settings.interval_minutes)
    } catch (error) {
      console.error('Network error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/save-auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          interval_minutes: intervalMinutes,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('Error saving auto-sync settings:', data.error)
        alert(`Failed to save settings: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Network error:', error)
      alert('Network error. Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="font-display font-black text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="border-2 border-black bg-white">
        {/* Header */}
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-2xl mb-2">AUTO-SYNC</h2>
          <p className="text-sm text-gray-600">
            Automatically check for new emails at regular intervals
          </p>
        </div>

        {/* Settings */}
        <div className="p-6 space-y-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 accent-[hsl(var(--electric-blue))]"
            />
            <span className="text-base font-medium">
              Enable automatic email checking
            </span>
          </label>

          {enabled && (
            <div className="pl-8 space-y-3">
              <label className="block text-sm font-bold mb-2">
                Check interval:
              </label>
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full px-4 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
              >
                {INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                Signal Digest will automatically check your email and import new newsletters
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t-2 border-black flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>
    </div>
  )
}
