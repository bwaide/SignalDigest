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

  if (userId) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', userId)
      .single()

    if (settings?.signal_sources) {
      const signalSources = settings.signal_sources as SignalSource[]
      const emailSource = signalSources.find(source => source.type === 'email')

      if (emailSource) {
        emailStatus = emailSource.status
      }
    }
  }

  // Fetch nuggets
  const { data: nuggets } = userId
    ? await supabase
        .from('nuggets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('relevancy_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: null }

  return (
    <>
      <DashboardV2 nuggets={nuggets || []} emailStatus={emailStatus} />
      <SettingsModal />
    </>
  )
}
