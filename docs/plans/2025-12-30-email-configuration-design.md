# Email Configuration Feature - Design Document

**Date:** December 30, 2025
**Status:** Approved for Implementation
**Feature:** IMAP Email Account Configuration

## Overview

Add the ability for users to configure their IMAP email account credentials securely, test the connection, and store them encrypted in Supabase Vault. This enables the email processing pipeline to fetch newsletters from a dedicated email account.

## Problem Statement

Users need to configure their dedicated newsletter email account before Signal Digest can fetch and process emails. The configuration must be:
- Secure (passwords encrypted in Supabase Vault)
- Validated (test connection before saving)
- User-friendly (clear status indicators)
- Extensible (support future signal source types)

## Solution

### Database Schema

**Migration: Add signal source configuration to user_settings**

```sql
ALTER TABLE user_settings ADD COLUMN signal_sources JSONB DEFAULT '[]'::jsonb;
```

**Signal Source Configuration Structure:**

```typescript
interface SignalSource {
  id: string;  // UUID for this source config
  type: 'email' | 'youtube' | 'rss' | 'podcast' | 'social_media';
  enabled: boolean;
  config: {
    // For email type:
    host?: string;
    port?: number;
    username?: string;
    vault_secret_id?: string;  // Reference to password in Supabase Vault
    use_tls?: boolean;
    // For future types: different fields
  };
  status: 'not_configured' | 'testing' | 'connected' | 'failed';
  last_tested_at?: string;
  last_error?: string;
}
```

**Example data:**
```json
{
  "signal_sources": [
    {
      "id": "uuid-123",
      "type": "email",
      "enabled": true,
      "config": {
        "host": "imap.gmail.com",
        "port": 993,
        "username": "newsletters@example.com",
        "vault_secret_id": "vault-ref-456",
        "use_tls": true
      },
      "status": "connected",
      "last_tested_at": "2025-12-30T10:00:00Z"
    }
  ]
}
```

**Why JSONB:**
- Single column scales to multiple signal sources and types
- Each source type has its own config structure
- Easy to add YouTube, RSS, etc. without schema changes
- Still maintains password security via Vault reference
- Can enable/disable sources independently

### Architecture & Data Flow

**Configuration Flow:**
1. User opens Settings modal → Email tab → fills IMAP form → clicks "Test Connection"
2. Next.js API route receives credentials → stores password in Supabase Vault → gets secret ID
3. Edge Function retrieves password from Vault → attempts IMAP connection → returns success/failure
4. If successful, user clicks "Save" → update `signal_sources` array in user_settings
5. Dashboard Header shows connection status indicator

**Key Components:**
- **Frontend:** Settings modal with IMAP form
- **API Route:** `/api/settings/test-email-connection` - Tests connection and returns result
- **API Route:** `/api/settings/save-email-config` - Saves configuration after successful test
- **Edge Function:** `test-imap-connection` - Securely tests IMAP connection using Vault credentials
- **Database:** user_settings.signal_sources JSONB column

### Component Structure

```
components/
  settings/
    SettingsModal.tsx          // Main modal container
    EmailSourceForm.tsx        // IMAP configuration form
    ConnectionStatus.tsx       // Status indicator with icon
```

**SettingsModal.tsx - Main Modal**
- Opens when Header "Settings" button is clicked
- Tabs: "Email", "Preferences", "Topics" (email tab active for MVP)
- Full-screen overlay with centered modal (max-width: 600px)
- Close button (X) and "Cancel" button
- Manages modal open/close state via Zustand

**EmailSourceForm.tsx - IMAP Form**

Fields:
- IMAP Host (text input, placeholder: "imap.gmail.com")
- Port (number input, default: 993)
- Username (email input, placeholder: "newsletters@example.com")
- Password (password input, with show/hide toggle)
- Use TLS (checkbox, default: checked)

Buttons:
- "Test Connection" (primary, triggers test without saving)
- "Save" (secondary, enabled only after successful test)
- "Cancel" (tertiary, closes modal)

States:
- Idle: All fields editable
- Testing: Spinner on "Test" button, form disabled
- Success: Green checkmark, "Connection successful" message, "Save" enabled
- Error: Red X, error message with technical details

**ConnectionStatus.tsx - Dashboard Indicator**

Located in Header component next to "Last sync" text:
- Not configured: Gray dot + "Email not configured"
- Connected: Green dot + "Email connected"
- Failed: Red dot + "Connection failed" (clickable to open settings)
- Testing: Yellow dot + "Testing connection..."

### User Flow

1. **Initial State:** Dashboard shows "Email not configured" status
2. **Open Settings:** User clicks "Settings" button in Header
3. **Configure:** Settings modal opens on "Email" tab
4. **Fill Form:** User enters IMAP credentials:
   - Host: imap.gmail.com
   - Port: 993
   - Username: newsletters@example.com
   - Password: [app-specific password]
   - Use TLS: ✓
5. **Test Connection:**
   - User clicks "Test Connection"
   - Button shows spinner, form disabled
   - API call to `/api/settings/test-email-connection`
   - Backend stores password in Vault, gets secret ID
   - Edge Function tests IMAP connection
6. **Success Path:**
   - Green checkmark appears with "Connection successful"
   - "Save" button becomes enabled
   - User clicks "Save"
   - Configuration stored in user_settings.signal_sources
   - Modal closes
   - Header status updates to "Email connected"
7. **Failure Path:**
   - Red X appears with error message: "Could not connect to IMAP server. Please check your credentials."
   - Fields remain editable
   - User can fix credentials and retry

### API Endpoints

**POST `/api/settings/test-email-connection`**

Request:
```typescript
{
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
}
```

Response (success):
```typescript
{
  success: true;
  vault_secret_id: string;  // ID of stored password in Vault
}
```

Response (failure):
```typescript
{
  success: false;
  error: string;  // User-friendly error message
  technical_details?: string;  // Technical details for debugging
}
```

**POST `/api/settings/save-email-config`**

Request:
```typescript
{
  host: string;
  port: number;
  username: string;
  vault_secret_id: string;  // From successful test
  use_tls: boolean;
}
```

Response:
```typescript
{
  success: true;
  source_id: string;  // UUID of created signal source
}
```

### Edge Function: test-imap-connection

**Purpose:** Securely test IMAP connection using credentials from Vault

**Implementation:**
- Receives: vault_secret_id, host, port, username, use_tls
- Retrieves password from Supabase Vault using service role
- Attempts IMAP connection using a Node.js IMAP library
- Tests: login, select INBOX, fetch 1 email (don't process)
- Returns: success/failure with error details
- Timeout: 10 seconds maximum

**IMAP Library:** Use `imap-simple` or `node-imap` for connection testing

### Security Considerations

1. **Password Storage:**
   - Never stored in plain text
   - Always encrypted in Supabase Vault
   - Only service role can retrieve from Vault
   - Frontend only sees vault_secret_id reference

2. **Connection Testing:**
   - Performed server-side only (Edge Function)
   - Frontend never has direct access to password
   - Timeout prevents hanging connections
   - Errors logged but passwords redacted

3. **API Security:**
   - All endpoints require authenticated user
   - RLS policies ensure users only access own settings
   - Rate limiting on test endpoint (max 5 tests per minute)

### Error Handling

**Connection Errors:**
- Invalid credentials → "Invalid username or password"
- Wrong host/port → "Could not connect to server. Please check host and port."
- Network timeout → "Connection timed out. Please check your internet connection."
- TLS errors → "TLS/SSL connection failed. Try disabling 'Use TLS' if your server doesn't support it."

**Vault Errors:**
- Vault storage fails → "Could not securely store password. Please try again."
- Vault retrieval fails → "Could not retrieve password. Please reconfigure your email."

**General Principle:**
- Show user-friendly messages to users
- Log technical details server-side
- Provide "Contact Support" link for persistent issues

### Testing Strategy

**Unit Tests:**
- Email form validation
- JSONB signal source manipulation
- Vault secret ID storage/retrieval

**Integration Tests:**
- Test IMAP connection with valid credentials
- Test IMAP connection with invalid credentials
- Test password storage in Vault
- Test configuration save/load

**E2E Tests:**
- Full user flow: open settings → configure → test → save → verify status

### Implementation Tasks

1. **Database Migration:** Add signal_sources JSONB column
2. **Edge Function:** Create test-imap-connection function
3. **API Routes:** Create test and save endpoints
4. **Components:** Build SettingsModal, EmailSourceForm, ConnectionStatus
5. **Integration:** Wire up Header Settings button
6. **State Management:** Add settings modal state to Zustand
7. **Testing:** Unit, integration, and E2E tests
8. **Documentation:** Update README with email setup instructions

### Future Enhancements

- **Multiple Email Accounts:** Support configuring multiple email sources
- **OAuth Integration:** Add Gmail OAuth flow (no password needed)
- **Auto-detect Settings:** Detect IMAP settings from email provider
- **Connection Monitoring:** Periodic background connection tests
- **Advanced Options:** Custom folders, SSL certificate validation

## Success Criteria

- ✅ User can configure IMAP credentials
- ✅ Connection test completes in <10 seconds
- ✅ Password stored securely in Vault (never in database plain text)
- ✅ Clear error messages for connection failures
- ✅ Dashboard shows accurate connection status
- ✅ Configuration persists across sessions
- ✅ Works with Gmail, Outlook, and custom IMAP servers

## References

- Supabase Vault Documentation: https://supabase.com/docs/guides/database/vault
- Node IMAP Library: https://github.com/mscdex/node-imap
- Main Design Doc: `docs/plans/2025-12-30-signal-digest-design.md`
