'use client'

import { useSearchParams } from 'next/navigation'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SourcesTab } from '@/components/settings/SourcesTab'
import { AutoSyncTab } from '@/components/settings/AutoSyncTab'
import { PreferencesTab } from '@/components/settings/PreferencesTab'
import { ApiTab } from '@/components/settings/ApiTab'
import { EmailSourceForm } from '@/components/settings/EmailSourceForm'
import { Suspense } from 'react'

function SettingsContent() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'sources'

  return (
    <SettingsLayout activeTab={activeTab}>
      {activeTab === 'sources' && <SourcesTab />}
      {activeTab === 'email' && <EmailSourceForm />}
      {activeTab === 'auto-sync' && <AutoSyncTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
      {activeTab === 'api' && <ApiTab />}
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
