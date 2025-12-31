import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmptyState } from '@/components/dashboard/EmptyState'
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

  return (
    <div className="flex h-screen flex-col">
      <Header emailStatus={emailStatus} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <EmptyState />
        </main>
      </div>
      <SettingsModal />
    </div>
  )
}
