#!/bin/bash

# Export development data for migration to production
# This script exports user_settings, signals, and nuggets from local dev database

set -e

DEV_USER_ID="d87dcb3e-78b2-4e84-b7c2-51ba5368600d"
PROD_USER_ID="f122b84f-8ee1-436d-a0df-0285d93caaaf"
OUTPUT_FILE="scripts/migrate-dev-to-prod.sql"

echo "Exporting development data..."
echo "Dev User ID:  $DEV_USER_ID"
echo "Prod User ID: $PROD_USER_ID"
echo ""

# Start building the SQL file
cat > "$OUTPUT_FILE" << 'EOF'
-- Migration script to copy development data to production
-- Generated from local development environment
--
-- Run this script on production database after deployment
-- Usage: supabase db execute -f scripts/migrate-dev-to-prod.sql --linked

BEGIN;

EOF

echo "-- Prod User ID: $PROD_USER_ID" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Export user_settings
echo "Exporting user_settings..."
supabase db execute --local "
SELECT 'INSERT INTO user_settings (user_id, interests_description, relevancy_threshold, approved_topics, signal_sources, auto_sync_enabled, auto_sync_interval_minutes, created_at, updated_at) VALUES (' ||
  quote_literal('$PROD_USER_ID') || ', ' ||
  quote_nullable(interests_description) || ', ' ||
  COALESCE(relevancy_threshold::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(approved_topics::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(signal_sources::text), 'NULL') || ', ' ||
  COALESCE(auto_sync_enabled::text, 'false') || ', ' ||
  COALESCE(auto_sync_interval_minutes::text, 'NULL') || ', ' ||
  quote_literal(created_at::text) || '::timestamptz, ' ||
  quote_literal(updated_at::text) || '::timestamptz);'
FROM user_settings
WHERE user_id = '$DEV_USER_ID'
" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"

# Export signals
echo "Exporting signals..."
echo "-- Signals" >> "$OUTPUT_FILE"
supabase db execute --local "
SELECT 'INSERT INTO signals (id, user_id, signal_type, title, raw_content, source_identifier, source_url, received_date, status, metadata, created_at, updated_at, retry_count, error_message) VALUES (' ||
  quote_literal(id::text) || '::uuid, ' ||
  quote_literal('$PROD_USER_ID') || ', ' ||
  quote_literal(signal_type) || ', ' ||
  quote_nullable(title) || ', ' ||
  quote_nullable(raw_content) || ', ' ||
  quote_nullable(source_identifier) || ', ' ||
  quote_nullable(source_url) || ', ' ||
  quote_literal(received_date::text) || '::timestamptz, ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(metadata::text), 'NULL') || '::jsonb, ' ||
  quote_literal(created_at::text) || '::timestamptz, ' ||
  quote_literal(updated_at::text) || '::timestamptz, ' ||
  COALESCE(retry_count::text, '0') || ', ' ||
  quote_nullable(error_message) || ');'
FROM signals
WHERE user_id = '$DEV_USER_ID'
ORDER BY created_at
" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"

# Export nuggets
echo "Exporting nuggets..."
echo "-- Nuggets" >> "$OUTPUT_FILE"
supabase db execute --local "
SELECT 'INSERT INTO nuggets (id, user_id, signal_id, title, summary, content, url, relevancy_score, topic, is_read, is_archived, notes, duplicate_group_id, is_primary, created_at, updated_at, status) VALUES (' ||
  quote_literal(id::text) || '::uuid, ' ||
  quote_literal('$PROD_USER_ID') || ', ' ||
  quote_literal(signal_id::text) || '::uuid, ' ||
  quote_nullable(title) || ', ' ||
  quote_nullable(summary) || ', ' ||
  quote_nullable(content) || ', ' ||
  quote_nullable(url) || ', ' ||
  COALESCE(relevancy_score::text, 'NULL') || ', ' ||
  quote_nullable(topic) || ', ' ||
  COALESCE(is_read::text, 'false') || ', ' ||
  COALESCE(is_archived::text, 'false') || ', ' ||
  quote_nullable(notes) || ', ' ||
  COALESCE(quote_literal(duplicate_group_id::text), 'NULL') || '::uuid, ' ||
  COALESCE(is_primary::text, 'true') || ', ' ||
  quote_literal(created_at::text) || '::timestamptz, ' ||
  quote_literal(updated_at::text) || '::timestamptz, ' ||
  quote_literal(status) || ');'
FROM nuggets
WHERE user_id = '$DEV_USER_ID'
ORDER BY created_at
" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "COMMIT;" >> "$OUTPUT_FILE"

echo ""
echo "✓ Export complete!"
echo "  Output: $OUTPUT_FILE"
echo ""
echo "To apply to production:"
echo "  1. Review the SQL file: cat $OUTPUT_FILE"
echo "  2. Link to production: supabase link --project-ref vpezbtgpovtxxltwdgnw"
echo "  3. Execute: supabase db execute -f $OUTPUT_FILE --linked"
echo ""
