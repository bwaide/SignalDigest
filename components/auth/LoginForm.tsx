'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup' | 'magic-link'>('login')
  const router = useRouter()
  const supabase = createClient()

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        setMessage('Check your email to confirm your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setMessage('Check your email for the magic link!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 border-4 border-black shadow-brutal">
      <h1 className="font-display font-black text-4xl mb-2">
        {mode === 'signup' ? 'SIGN UP' : mode === 'magic-link' ? 'MAGIC LINK' : 'LOGIN'}
      </h1>
      <p className="font-serif text-foreground/60 mb-6">
        {mode === 'signup'
          ? 'Create your Signal Digest account'
          : mode === 'magic-link'
          ? 'Sign in with a magic link sent to your email'
          : 'Sign in to your Signal Digest account'}
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 text-red-700 font-serif text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-green-50 border-2 border-green-500 text-green-700 font-serif text-sm">
          {message}
        </div>
      )}

      <form onSubmit={mode === 'magic-link' ? handleMagicLink : handleEmailPassword} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-display font-bold text-sm mb-2">
            EMAIL
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border-2 border-black font-serif focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
            placeholder="your@email.com"
          />
        </div>

        {mode !== 'magic-link' && (
          <div>
            <label htmlFor="password" className="block font-display font-bold text-sm mb-2">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border-2 border-black font-serif focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
              placeholder="••••••••"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-lg border-2 border-black shadow-brutal hover:shadow-brutal-lg hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          {isLoading
            ? 'LOADING...'
            : mode === 'signup'
            ? 'SIGN UP'
            : mode === 'magic-link'
            ? 'SEND MAGIC LINK'
            : 'LOGIN'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t-2 border-black/10 space-y-3">
        {mode === 'login' && (
          <>
            <button
              onClick={() => setMode('signup')}
              className="w-full text-center font-serif text-sm text-foreground/60 hover:text-foreground"
            >
              Don't have an account? <span className="font-bold">Sign up</span>
            </button>
            <button
              onClick={() => setMode('magic-link')}
              className="w-full text-center font-serif text-sm text-foreground/60 hover:text-foreground"
            >
              Prefer passwordless? <span className="font-bold">Use magic link</span>
            </button>
          </>
        )}

        {(mode === 'signup' || mode === 'magic-link') && (
          <button
            onClick={() => setMode('login')}
            className="w-full text-center font-serif text-sm text-foreground/60 hover:text-foreground"
          >
            Already have an account? <span className="font-bold">Login</span>
          </button>
        )}
      </div>
    </div>
  )
}
