import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { createClient } from '@/lib/supabase/server'
import type { SignalSource, SignalSourceStatus } from '@/types/signal-sources'

export default async function Home() {
  // Fetch user settings to determine email connection status
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let emailStatus: SignalSourceStatus = 'not_configured'

  if (user) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('signal_sources')
      .eq('user_id', user.id)
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
