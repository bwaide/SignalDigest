// Signal source types for extensible signal configuration
// Matches signal_sources JSONB structure in user_settings table

export type SignalSourceType = 'email' | 'youtube' | 'rss' | 'podcast' | 'social_media'

export type SignalSourceStatus = 'not_configured' | 'testing' | 'connected' | 'failed'

export interface EmailSourceConfig {
  host: string
  port: number
  username: string
  vault_secret_id: string  // Reference to password in Supabase Vault
  use_tls: boolean
}

export interface SignalSource {
  id: string  // UUID
  type: SignalSourceType
  enabled: boolean
  config: EmailSourceConfig | Record<string, unknown>  // Extensible for future types
  status: SignalSourceStatus
  last_tested_at?: string  // ISO 8601 timestamp
  last_error?: string
}

export interface UserSettings {
  signal_sources: SignalSource[]
}
