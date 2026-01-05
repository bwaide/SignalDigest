'use client'

import { useState, useEffect } from 'react'

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
]

export function AutoSyncSettings() {
  const [enabled, setEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(30)
  const [isSaving, setIsSaving] = useState(false)

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
      } else {
        // Trigger a page reload to apply new settings
        window.location.reload()
      }
    } catch (error) {
      console.error('Network error:', error)
      alert('Network error. Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-black text-2xl mb-4">AUTO-SYNC</h3>
        <p className="font-serif text-sm text-foreground/60 mb-6">
          Automatically check for new emails at regular intervals
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 accent-[hsl(var(--electric-blue))]"
          />
          <span className="font-serif text-base">
            Enable automatic email checking
          </span>
        </label>

        {enabled && (
          <div className="pl-8 space-y-2">
            <label className="block font-serif text-sm text-foreground/80 mb-2">
              Check interval:
            </label>
            <select
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className="w-full px-4 py-2 border-2 border-black bg-white font-serif focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
            >
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t-2 border-black/10">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          {isSaving ? 'SAVING...' : 'SAVE'}
        </button>
      </div>
    </div>
  )
}
