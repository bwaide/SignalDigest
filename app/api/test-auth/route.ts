import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  console.log('[TEST-AUTH] Test endpoint called')

  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    console.log('[TEST-AUTH] User check result:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!error,
      errorMessage: error?.message
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        error: error?.message || 'No user',
      })
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error('[TEST-AUTH] Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Exception occurred',
    }, { status: 500 })
  }
}

export async function POST() {
  console.log('[TEST-AUTH] POST endpoint called')
  return GET()
}
