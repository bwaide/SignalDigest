# Auto-Sync Implementation

## Overview

The auto-sync feature automatically checks for new emails at regular intervals and processes them into nuggets. This implementation runs entirely in the browser using JavaScript timers.

## Architecture

### Core Components

1. **AutoSyncManager** ([lib/auto-sync.ts](../lib/auto-sync.ts))
   - Manages the interval timer for periodic sync operations
   - Handles start/stop lifecycle
   - Allows dynamic interval updates
   - Provides status reporting

2. **useAutoSync Hook** ([lib/hooks/use-auto-sync.ts](../lib/hooks/use-auto-sync.ts))
   - React hook that integrates AutoSyncManager with component lifecycle
   - Automatically starts/stops based on enabled state
   - Cleans up timers on component unmount

3. **AutoSyncSettings Component** ([components/settings/AutoSyncSettings.tsx](../components/settings/AutoSyncSettings.tsx))
   - UI for configuring auto-sync preferences
   - Toggle to enable/disable
   - Dropdown to select interval (15 min, 30 min, 1 hr, 2 hr, 4 hr)
   - Saves settings to database

### Database Schema

Migration: [20260104205311_add_auto_sync_settings.sql](../supabase/migrations/20260104205311_add_auto_sync_settings.sql)

Added columns to `user_settings` table:
- `auto_sync_enabled` (BOOLEAN, default: false)
- `auto_sync_interval_minutes` (INTEGER, default: 30)

## User Flow

1. User opens Settings → Auto-Sync tab
2. Enable auto-sync checkbox and select desired interval
3. Click "SAVE" to persist settings (triggers page reload)
4. DashboardV2 component receives auto-sync settings from server
5. useAutoSync hook initializes AutoSyncManager
6. Manager runs sync operation immediately on start
7. Then repeats at specified interval
8. Each sync:
   - Calls `/api/emails/import` to fetch new emails
   - If new emails found, calls `/api/signals/process` to extract nuggets
   - Reloads page to display new content

## Implementation Details

### DashboardV2 Integration

```typescript
const handleAutoSync = useCallback(async () => {
  // Import emails
  const importResponse = await fetch('/api/emails/import', { method: 'POST' })
  const importData = await importResponse.json()

  if (!importResponse.ok || !importData.success || importData.imported === 0) {
    return
  }

  // Process signals
  await fetch('/api/signals/process', { method: 'POST' })

  // Reload page to show new nuggets
  window.location.reload()
}, [])

useAutoSync({
  enabled: autoSyncEnabled && emailStatus === 'connected',
  intervalMinutes: autoSyncIntervalMinutes,
  onSync: handleAutoSync
})
```

### Safety Features

- Auto-sync only runs when email is configured (`emailStatus === 'connected'`)
- Silent error handling - failures logged to console but don't interrupt
- Timer cleanup on component unmount prevents memory leaks
- Page reload ensures fresh data display

## Configuration Options

| Interval | Value (minutes) | Use Case |
|----------|----------------|----------|
| 15 minutes | 15 | High-frequency newsletters |
| 30 minutes | 30 | Default, balanced |
| 1 hour | 60 | Low-frequency newsletters |
| 2 hours | 120 | Very infrequent checking |
| 4 hours | 240 | Minimal bandwidth usage |

## Future Enhancements

Potential improvements:
1. Visual indicator showing time until next sync
2. Toast notifications when new nuggets arrive
3. Smart scheduling (only check during business hours)
4. Server-side cron for more reliable scheduling
5. Background sync using Service Workers
6. Sync status indicator in header
