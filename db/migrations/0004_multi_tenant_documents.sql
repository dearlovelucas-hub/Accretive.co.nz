-- Multi-tenant organisations/users/documents model with strict privacy constraints.
-- NOTE: Existing code uses TEXT ids; keeping TEXT ids preserves backward compatibility
-- while still enforcing org-user-document integrity at the database level.

CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill organisations from legacy orgs table.
INSERT INTO organisations (id, name)
SELECT o.id, o.name
FROM orgs o
ON CONFLICT (id) DO NOTHING;

-- Ensure at least one org exists for backfilling nullable users.org_id.
INSERT INTO organisations (id, name)
VALUES ('org_demo', 'Accretive Demo')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill stable, unique-ish emails for existing rows.
UPDATE users
SET email = COALESCE(NULLIF(email, ''), lower(username) || '@accretive.local')
WHERE email IS NULL OR email = '';

ALTER TABLE users
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Role hardening for admin/member model.
UPDATE users
SET role = 'member'
WHERE role NOT IN ('admin', 'member');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'member'));

-- password_hash is now nullable to support external auth options.
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- Ensure org_id is always present.
UPDATE users
SET org_id = 'org_demo'
WHERE org_id IS NULL;

ALTER TABLE users
  ALTER COLUMN org_id SET NOT NULL;

-- Re-point users.org_id FK to organisations.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname
  INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'f'
    AND conname = 'users_org_id_fkey'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

-- Composite uniqueness to support strong org-consistency FK from documents.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_id_org_id_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_id_org_id_unique UNIQUE (id, org_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('generated', 'failed')),
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT documents_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT documents_owner_user_org_fkey
    FOREIGN KEY (owner_user_id, org_id) REFERENCES users(id, org_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS documents_owner_user_id_created_at_idx
  ON documents(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_org_id_created_at_idx
  ON documents(org_id, created_at DESC);
