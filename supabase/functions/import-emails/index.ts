import { createClient } from 'supabase'
import { ImapFlow } from 'npm:imapflow@1.0.164'

interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
}

async function connectToImap(config: ImapConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.use_tls,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false, // Disable logging in production
  })

  await client.connect()
  return client
}

async function getEmailConfig(supabase: any, userId: string) {
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('signal_sources')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch email config: ${error.message}`)
  }

  const emailSource = settings?.signal_sources?.find((s: any) => s.type === 'email')
  if (!emailSource || emailSource.status !== 'connected') {
    throw new Error('Email source not configured or not connected')
  }

  return emailSource.config
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user ID from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get email config
    const emailConfig = await getEmailConfig(supabase, user.id)

    // For MVP: password is stored in config (not Vault yet)
    // TODO: Retrieve from Vault using vault_secret_id
    const imapConfig: ImapConfig = {
      host: emailConfig.host,
      port: emailConfig.port,
      username: emailConfig.username,
      password: 'PLACEHOLDER', // Will be from Vault
      use_tls: emailConfig.use_tls,
    }

    // Test connection
    const client = await connectToImap(imapConfig)
    await client.logout()

    return new Response(
      JSON.stringify({ success: true, message: 'IMAP connection successful' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
