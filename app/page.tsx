import { DashboardV2 } from '@/components/v2/DashboardV2'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { createClient } from '@/lib/supabase/server'
import type { SignalSource, SignalSourceStatus } from '@/types/signal-sources'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  const userId = user.id

  let emailStatus: SignalSourceStatus = 'not_configured'

  let autoSyncEnabled = false
  let autoSyncIntervalMinutes = 30

  {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources, auto_sync_enabled, auto_sync_interval_minutes')
      .eq('user_id', userId)
      .single()

    if (settings?.signal_sources) {
      const signalSources = settings.signal_sources as SignalSource[]
      const emailSource = signalSources.find(source => source.type === 'email')

      if (emailSource) {
        emailStatus = emailSource.status
      }
    }

    autoSyncEnabled = settings?.auto_sync_enabled ?? false
    autoSyncIntervalMinutes = settings?.auto_sync_interval_minutes ?? 30
  }

  // Fetch nuggets (unread and saved, excluding archived)
  const { data: nuggets } = await supabase
    .from('nuggets')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['unread', 'saved'])
    .order('relevancy_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch archived nuggets separately
  const { data: archivedNuggets } = await supabase
    .from('nuggets')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <DashboardV2
        nuggets={nuggets || []}
        archivedNuggets={archivedNuggets || []}
        emailStatus={emailStatus}
        autoSyncEnabled={autoSyncEnabled}
        autoSyncIntervalMinutes={autoSyncIntervalMinutes}
      />
      <SettingsModal />
    </>
  )
}
