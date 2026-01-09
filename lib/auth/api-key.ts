import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

const KEY_PREFIX = 'sd_live_'
const BCRYPT_ROUNDS = 10

/**
 * Generates a new API key with the format: sd_live_<32 random chars>
 */
export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return `${KEY_PREFIX}${randomPart}`
}

/**
 * Hashes an API key using bcrypt for secure storage
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS)
}

/**
 * Validates an API key from an Authorization header
 * Returns the user ID if valid, null otherwise
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<{ id: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const key = authHeader.slice(7)
  if (!key.startsWith(KEY_PREFIX)) {
    return null
  }

  const supabase = createServiceRoleClient()

  // For single-user system, fetch users with an API key
  // In a multi-tenant system, you'd use a key prefix lookup table
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('user_id, api_key_hash')
    .not('api_key_hash', 'is', null)

  if (error || !settings?.length) {
    return null
  }

  // Check each user's key (for single user, this is just one)
  for (const setting of settings) {
    if (setting.api_key_hash) {
      const isValid = await bcrypt.compare(key, setting.api_key_hash)
      if (isValid) {
        return { id: setting.user_id }
      }
    }
  }

  return null
}
