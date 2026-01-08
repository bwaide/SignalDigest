'use client'

import { useRouter } from 'next/navigation'

interface Tab {
  id: string
  label: string
}

const TABS: Tab[] = [
  { id: 'sources', label: 'SOURCES' },
  { id: 'auto-sync', label: 'AUTO-SYNC' },
  { id: 'preferences', label: 'PREFERENCES' }
]

export function SettingsLayout({
  activeTab,
  children
}: {
  activeTab: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-2 border-black">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display font-black text-2xl">SETTINGS</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white border-2 border-black hover:bg-black hover:text-white font-display font-black text-sm transition-colors"
          >
            BACK TO INBOX ▶
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="fixed top-[69px] md:top-[84px] left-0 right-0 z-40 bg-white border-b-2 border-black/10 pt-2">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(`/settings?tab=${tab.id}`)}
              className={`flex-1 md:flex-none md:px-6 py-3 font-display font-black text-sm transition-all border-r-2 border-black/10 ${
                activeTab === tab.id
                  ? 'bg-[hsl(var(--electric-blue))] text-white'
                  : 'bg-white text-black hover:bg-black/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <main className="pt-[129px] md:pt-[136px] px-4 md:px-6 pb-32 max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}
