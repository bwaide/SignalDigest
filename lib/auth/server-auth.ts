import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Authenticates the current request and returns the user ID
 *
 * @returns Object with userId if authenticated, or error response if not
 */
export async function authenticateRequest(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // Log authentication failure for debugging
    console.error('[AUTH] Authentication failed:', {
      hasError: !!authError,
      errorMessage: authError?.message,
      errorName: authError?.name,
      hasUser: !!user,
    })

    return {
      userId: null,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      ),
    }
  }

  return {
    userId: user.id,
    error: null,
  }
}
