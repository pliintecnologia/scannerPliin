CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(120) NOT NULL,
  city VARCHAR(120) NOT NULL,
  company VARCHAR(160),
  cpf_hash CHAR(64) UNIQUE,
  cpf_last4 CHAR(4),
  cnpj_hash CHAR(64) UNIQUE,
  cnpj_last4 CHAR(4),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  document_hash CHAR(64) UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id, status);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (char_length(url) <= 2048),
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  classification VARCHAR(80),
  issue_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  result JSONB,
  error_message VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audits ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Migração segura de instalações anteriores: cada usuário existente recebe um tenant próprio.
DO $$
DECLARE
  account RECORD;
  generated_tenant UUID;
BEGIN
  FOR account IN SELECT u.id, u.name, u.company, u.cnpj_hash FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
  LOOP
    INSERT INTO tenants (name, document_hash)
    VALUES (COALESCE(NULLIF(account.company, ''), account.name || ' - Conta'), account.cnpj_hash)
    ON CONFLICT (document_hash) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO generated_tenant;
    INSERT INTO memberships (tenant_id, user_id, role) VALUES (generated_tenant, account.id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

UPDATE sessions s SET tenant_id = m.tenant_id
FROM memberships m WHERE s.user_id = m.user_id AND s.tenant_id IS NULL AND m.status = 'active';
UPDATE audits a SET tenant_id = m.tenant_id
FROM memberships m WHERE a.user_id = m.user_id AND a.tenant_id IS NULL AND m.status = 'active';

ALTER TABLE sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audits ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_membership_fk') THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_membership_fk
      FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audits_membership_fk') THEN
    ALTER TABLE audits ADD CONSTRAINT audits_membership_fk
      FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audits_tenant_created_idx ON audits(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audits_tenant_user_created_idx ON audits(tenant_id, user_id, created_at DESC);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audits_tenant_isolation ON audits;
CREATE POLICY audits_tenant_isolation ON audits
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  attempt_key CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_attempts_key_created_idx ON auth_attempts(attempt_key, created_at DESC);

REVOKE ALL ON audits FROM PUBLIC;
REVOKE ALL ON users FROM PUBLIC;
REVOKE ALL ON sessions FROM PUBLIC;
REVOKE ALL ON memberships FROM PUBLIC;
REVOKE ALL ON tenants FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO scanner_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, tenants, memberships, audits, auth_attempts TO scanner_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scanner_app;
