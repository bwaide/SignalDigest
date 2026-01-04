'use client'

import { useSettingsStore } from '@/lib/stores/settings-store'
import type { SignalSourceStatus } from '@/types/signal-sources'

interface EmptyStateV2Props {
  emailStatus?: SignalSourceStatus
}

export function EmptyStateV2({ emailStatus }: EmptyStateV2Props) {
  const openSettings = useSettingsStore((state) => state.openSettings)

  if (emailStatus === 'not_configured') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="max-w-2xl text-center">
          <div className="mb-8 animate-slide-in">
            <div className="inline-block px-6 py-3 bg-[hsl(var(--electric-blue))] text-white border-4 border-black shadow-brutal mb-6">
              <span className="font-display font-black text-6xl">!</span>
            </div>
          </div>

          <h2 className="font-display font-black text-5xl md:text-7xl tracking-tighter mb-6 animate-slide-in stagger-1">
            CONNECT YOUR INBOX
          </h2>

          <p className="font-serif text-xl text-foreground/70 mb-8 leading-relaxed animate-slide-in stagger-2">
            Signal Digest turns your newsletter flood into curated insights.
            <br />
            Connect your email to start extracting nuggets.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in stagger-3">
            <button
              onClick={openSettings}
              className="px-8 py-4 bg-black text-white border-4 border-black shadow-brutal hover:shadow-brutal-hover hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all font-display font-black text-lg"
            >
              CONFIGURE EMAIL
            </button>

            <a
              href="#how-it-works"
              className="px-8 py-4 bg-white border-4 border-black hover:bg-black hover:text-white transition-colors font-serif text-lg"
            >
              How it works →
            </a>
          </div>

          {/* How it works section */}
          <div id="how-it-works" className="mt-16 pt-16 border-t-4 border-black/10 text-left">
            <h3 className="font-display font-black text-3xl mb-8 tracking-tight">
              HOW IT WORKS
            </h3>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="p-6 border-4 border-black bg-white">
                <div className="text-4xl font-display font-black mb-4 text-[hsl(var(--electric-blue))]">01</div>
                <h4 className="font-display font-bold text-lg mb-2">Connect</h4>
                <p className="font-serif text-sm text-foreground/70">
                  Link your email inbox via IMAP. We&apos;ll monitor for newsletters automatically.
                </p>
              </div>

              <div className="p-6 border-4 border-black bg-white">
                <div className="text-4xl font-display font-black mb-4 text-[hsl(var(--neon-green))]">02</div>
                <h4 className="font-display font-bold text-lg mb-2">Extract</h4>
                <p className="font-serif text-sm text-foreground/70">
                  AI reads each newsletter and extracts key insights—the &quot;nuggets&quot; worth your attention.
                </p>
              </div>

              <div className="p-6 border-4 border-black bg-white">
                <div className="text-4xl font-display font-black mb-4 text-[hsl(var(--cyber-pink))]">03</div>
                <h4 className="font-display font-bold text-lg mb-2">Digest</h4>
                <p className="font-serif text-sm text-foreground/70">
                  Browse curated insights, filter by topic, and focus on what matters most.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (emailStatus === 'failed') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="max-w-lg text-center">
          <div className="mb-8">
            <div className="inline-block px-6 py-3 bg-[hsl(var(--warning-orange))] text-white border-4 border-black shadow-brutal mb-6">
              <span className="font-display font-black text-6xl">⚠</span>
            </div>
          </div>

          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tighter mb-4">
            CONNECTION FAILED
          </h2>

          <p className="font-serif text-lg text-foreground/70 mb-8">
            Unable to connect to your email inbox. Check your settings and try again.
          </p>

          <button
            onClick={openSettings}
            className="px-8 py-4 bg-black text-white border-4 border-black shadow-brutal hover:shadow-brutal-hover hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all font-display font-black"
          >
            FIX SETTINGS
          </button>
        </div>
      </div>
    )
  }

  // Connected but no nuggets yet
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-lg text-center">
        <div className="mb-8 animate-slide-in">
          <div className="inline-block px-6 py-3 bg-white border-4 border-black shadow-brutal mb-6">
            <span className="font-display font-black text-6xl">📬</span>
          </div>
        </div>

        <h2 className="font-display font-black text-4xl md:text-5xl tracking-tighter mb-4 animate-slide-in stagger-1">
          NO NUGGETS YET
        </h2>

        <p className="font-serif text-lg text-foreground/70 mb-8 animate-slide-in stagger-2">
          Your inbox is connected. Click SYNC to import and process your newsletters.
        </p>

        <div className="animate-slide-in stagger-3">
          <p className="font-serif text-sm text-foreground/50">
            Tip: Use the ⚡ SYNC button in the top-right corner
          </p>
        </div>
      </div>
    </div>
  )
}
