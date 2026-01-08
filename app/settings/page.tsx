'use client'

import { useSearchParams } from 'next/navigation'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SourcesTab } from '@/components/settings/SourcesTab'
import { Suspense } from 'react'

function SettingsContent() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'sources'

  return (
    <SettingsLayout activeTab={activeTab}>
      {activeTab === 'sources' && <SourcesTab />}
      {activeTab === 'auto-sync' && (
        <div className="p-8 border-2 border-black text-center">
          <p className="font-display font-black text-lg">AUTO-SYNC SETTINGS</p>
          <p className="text-sm mt-2">Coming soon - migrate existing auto-sync settings here</p>
        </div>
      )}
      {activeTab === 'preferences' && (
        <div className="p-8 border-2 border-black text-center">
          <p className="font-display font-black text-lg">PREFERENCES</p>
          <p className="text-sm mt-2">Coming soon - migrate existing preferences here</p>
        </div>
      )}
    </SettingsLayout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
