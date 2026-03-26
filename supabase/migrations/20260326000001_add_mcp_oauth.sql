-- MCP OAuth: Client registrations (Dynamic Client Registration)
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  grant_types TEXT[] NOT NULL DEFAULT '{authorization_code}',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MCP OAuth: Authorization codes (short-lived, 10 minutes)
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MCP OAuth: Access tokens (long-lived, 30 days)
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{mcp:tools}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lookup performance
CREATE INDEX idx_mcp_oauth_codes_expires ON mcp_oauth_codes(expires_at);
CREATE INDEX idx_mcp_oauth_tokens_expires ON mcp_oauth_tokens(expires_at);

-- Enable RLS (deny-all default: only service role can access these tables)
ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Cleanup function for expired codes and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_oauth()
RETURNS void AS $$
BEGIN
  DELETE FROM mcp_oauth_codes WHERE expires_at < NOW();
  DELETE FROM mcp_oauth_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
