import Link from 'next/link'

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--electric-blue))]/10 to-[hsl(var(--hot-pink))]/10">
      <div className="w-full max-w-md bg-white p-8 border-4 border-black shadow-brutal">
        <h1 className="font-display font-black text-4xl mb-2">AUTH ERROR</h1>
        <p className="font-serif text-foreground/80 mb-6">
          There was an error authenticating your account. The link may have expired or already been used.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-6 py-3 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-lg border-2 border-black shadow-brutal hover:shadow-brutal-lg hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all"
        >
          TRY AGAIN
        </Link>
      </div>
    </div>
  )
}
