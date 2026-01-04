'use client'

import { useState } from 'react'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { EmailSourceForm } from './EmailSourceForm'
import { SignalsList } from './SignalsList'

type Tab = 'email' | 'signals'

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<Tab>('email')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
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
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'email'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Email Configuration
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'signals'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Signals
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto mb-6">
          {activeTab === 'email' && <EmailSourceForm />}
          {activeTab === 'signals' && <SignalsList />}
        </div>
        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            onClick={closeSettings}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
