// Auto-sync Edge Function
// This function is triggered by pg_cron to automatically import emails for users

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    // Verify this request is from an authenticated source
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body to get user_id
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role to bypass RLS for cron jobs
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if auto-sync is enabled for this user
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('auto_sync_enabled')
      .eq('user_id', user_id)
      .single()

    if (settingsError || !settings?.auto_sync_enabled) {
      return new Response(
        JSON.stringify({
          message: 'Auto-sync not enabled for this user',
          user_id
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call the email import API endpoint
    const importUrl = `${supabaseUrl.replace('supabase.co', 'supabase.co')}/functions/v1/import-emails`

    const importResponse = await fetch(importUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    })

    const importResult = await importResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        import_result: importResult,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Auto-sync error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
