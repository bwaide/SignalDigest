'use client'

import { useSettingsStore } from '@/lib/stores/settings-store'
import { EmailSourceForm } from './EmailSourceForm'

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettingsStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={closeSettings}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close settings"
        >
          ✕
        </button>
        <h2 className="mb-6 text-2xl font-bold">Settings</h2>
        <div className="mb-6 border-b">
          <div className="flex gap-4">
            <button className="border-b-2 border-primary px-4 py-2 font-medium text-primary">
              Email
            </button>
            <button className="px-4 py-2 text-gray-500" disabled>
              Preferences
            </button>
            <button className="px-4 py-2 text-gray-500" disabled>
              Topics
            </button>
          </div>
        </div>
        <div className="mb-6">
          <EmailSourceForm />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={closeSettings}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
