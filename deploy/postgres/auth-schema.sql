-- VPS-only local authentication schema.
-- This file does not alter any of the 32 migrated business tables.

CREATE TABLE IF NOT EXISTS vps_auth_accounts (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vps_auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  email TEXT NOT NULL REFERENCES vps_auth_accounts(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vps_auth_sessions_email_active
  ON vps_auth_sessions (email, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vps_auth_sessions_expiry
  ON vps_auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS vps_auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vps_auth_attempts_ip_time
  ON vps_auth_login_attempts (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vps_auth_attempts_email_time
  ON vps_auth_login_attempts (email, created_at DESC);
