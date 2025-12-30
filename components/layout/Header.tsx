'use client'

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">Signal Digest</h1>
          <span className="text-sm text-muted-foreground">
            Last sync: Never
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled
          >
            🔄 Check Now
          </button>
          <button
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            disabled
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    </header>
  )
}
