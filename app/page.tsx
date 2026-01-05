import { DashboardV2 } from '@/components/v2/DashboardV2'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { SignalSource, SignalSourceStatus } from '@/types/signal-sources'

export default async function Home() {
  // TODO: Remove DEV_MODE bypass before production deployment
  const DEV_MODE = process.env.NODE_ENV === 'development'

  // In dev mode, use service role client to bypass RLS
  const supabase = DEV_MODE ? createServiceRoleClient() : await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id || (DEV_MODE ? '00000000-0000-0000-0000-000000000000' : null)

  let emailStatus: SignalSourceStatus = 'not_configured'

  let autoSyncEnabled = false
  let autoSyncIntervalMinutes = 30

  if (userId) {
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
  const { data: nuggets } = userId
    ? await supabase
        .from('nuggets')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['unread', 'saved'])
        .order('relevancy_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: null }

  // Fetch archived nuggets separately
  const { data: archivedNuggets } = userId
    ? await supabase
        .from('nuggets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: null }

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
