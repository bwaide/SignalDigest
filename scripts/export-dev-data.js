#!/usr/bin/env node

/**
 * Export development data for migration to production
 * This script exports user_settings, signals, and nuggets from local dev database
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const DEV_USER_ID = 'd87dcb3e-78b2-4e84-b7c2-51ba5368600d'
const PROD_USER_ID = 'f122b84f-8ee1-436d-a0df-0285d93caaaf'
const OUTPUT_FILE = 'scripts/migrate-dev-to-prod.sql'

// Local Supabase connection
const supabase = createClient(
  'http://127.0.0.1:54331',
  'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz' // Service role key from .env.local
)

function escapeSQL(value, columnName = null) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'object') {
    // Handle TEXT[] arrays (like approved_topics)
    if (columnName === 'approved_topics' && Array.isArray(value)) {
      const escapedArray = value.map(item => `'${item.toString().replace(/'/g, "''")}'`).join(',')
      return `ARRAY[${escapedArray}]`
    }
    // Handle JSONB objects/arrays (like signal_sources, metadata)
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  return `'${value.toString().replace(/'/g, "''")}'`
}

async function exportData() {
  console.log('Exporting development data...')
  console.log('Dev User ID: ', DEV_USER_ID)
  console.log('Prod User ID:', PROD_USER_ID)
  console.log('')

  let sql = `-- Migration script to copy development data to production
-- Generated from local development environment
--
-- Run this script on production database after deployment
-- Production User ID: ${PROD_USER_ID}

BEGIN;

`

  // Export user_settings
  console.log('Exporting user_settings...')
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', DEV_USER_ID)
    .single()

  if (settings) {
    sql += `-- User Settings\n`
    sql += `INSERT INTO user_settings (
  user_id,
  interests_description,
  relevancy_threshold,
  approved_topics,
  signal_sources,
  auto_sync_enabled,
  auto_sync_interval_minutes,
  created_at,
  updated_at
) VALUES (
  '${PROD_USER_ID}',
  ${escapeSQL(settings.interests_description)},
  ${settings.relevancy_threshold || 'NULL'},
  ${escapeSQL(settings.approved_topics, 'approved_topics')},
  ${escapeSQL(settings.signal_sources, 'signal_sources')},
  ${settings.auto_sync_enabled || false},
  ${settings.auto_sync_interval_minutes || 'NULL'},
  '${settings.created_at}'::timestamptz,
  '${settings.updated_at}'::timestamptz
) ON CONFLICT (user_id) DO UPDATE SET
  interests_description = EXCLUDED.interests_description,
  relevancy_threshold = EXCLUDED.relevancy_threshold,
  approved_topics = EXCLUDED.approved_topics,
  signal_sources = EXCLUDED.signal_sources,
  auto_sync_enabled = EXCLUDED.auto_sync_enabled,
  auto_sync_interval_minutes = EXCLUDED.auto_sync_interval_minutes,
  updated_at = EXCLUDED.updated_at;

`
  }

  // Export signals
  console.log('Exporting signals...')
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('user_id', DEV_USER_ID)
    .order('created_at')

  if (signals && signals.length > 0) {
    sql += `-- Signals (${signals.length} records)\n`
    for (const signal of signals) {
      sql += `INSERT INTO signals (
  id,
  user_id,
  signal_type,
  title,
  raw_content,
  source_identifier,
  source_url,
  received_date,
  status,
  metadata,
  created_at,
  updated_at,
  retry_count,
  error_message
) VALUES (
  '${signal.id}'::uuid,
  '${PROD_USER_ID}',
  ${escapeSQL(signal.signal_type)},
  ${escapeSQL(signal.title)},
  ${escapeSQL(signal.raw_content)},
  ${escapeSQL(signal.source_identifier)},
  ${escapeSQL(signal.source_url)},
  '${signal.received_date}'::timestamptz,
  ${escapeSQL(signal.status)},
  ${escapeSQL(signal.metadata)},
  '${signal.created_at}'::timestamptz,
  '${signal.updated_at}'::timestamptz,
  ${signal.retry_count || 0},
  ${escapeSQL(signal.error_message)}
);

`
    }
  }

  // Export nuggets
  console.log('Exporting nuggets...')
  const { data: nuggets } = await supabase
    .from('nuggets')
    .select('*')
    .eq('user_id', DEV_USER_ID)
    .order('created_at')

  if (nuggets && nuggets.length > 0) {
    sql += `-- Nuggets (${nuggets.length} records)\n`
    for (const nugget of nuggets) {
      sql += `INSERT INTO nuggets (
  id,
  user_id,
  signal_id,
  title,
  summary,
  content,
  url,
  relevancy_score,
  topic,
  is_read,
  is_archived,
  notes,
  duplicate_group_id,
  is_primary,
  created_at,
  updated_at,
  status
) VALUES (
  '${nugget.id}'::uuid,
  '${PROD_USER_ID}',
  '${nugget.signal_id}'::uuid,
  ${escapeSQL(nugget.title)},
  ${escapeSQL(nugget.summary)},
  ${escapeSQL(nugget.content)},
  ${escapeSQL(nugget.url)},
  ${nugget.relevancy_score || 'NULL'},
  ${escapeSQL(nugget.topic)},
  ${nugget.is_read || false},
  ${nugget.is_archived || false},
  ${escapeSQL(nugget.notes)},
  ${nugget.duplicate_group_id ? `'${nugget.duplicate_group_id}'::uuid` : 'NULL'},
  ${nugget.is_primary !== false},
  '${nugget.created_at}'::timestamptz,
  '${nugget.updated_at}'::timestamptz,
  ${escapeSQL(nugget.status)}
);

`
    }
  }

  sql += `COMMIT;\n`

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, sql)

  console.log('')
  console.log('✓ Export complete!')
  console.log(`  Output: ${OUTPUT_FILE}`)
  console.log(`  Signals: ${signals?.length || 0}`)
  console.log(`  Nuggets: ${nuggets?.length || 0}`)
  console.log('')
  console.log('To apply to production:')
  console.log('  1. Review the SQL file: cat scripts/migrate-dev-to-prod.sql')
  console.log('  2. Link to production: supabase link --project-ref vpezbtgpovtxxltwdgnw')
  console.log('  3. Execute on production database (via Supabase Studio SQL editor)')
  console.log('')
}

exportData().catch(console.error)
