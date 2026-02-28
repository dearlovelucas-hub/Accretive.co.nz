-- Strict RLS isolation for the documents table.
-- Every document operation must be preceded (within the same transaction) by:
--   SET LOCAL app.user_id = '<authenticated_user_id>';
--   SET LOCAL app.org_id  = '<authenticated_org_id>';
--
-- When either setting is absent, current_setting(..., true) returns NULL.
-- NULL comparisons evaluate to NULL (not TRUE), so all rows are hidden by default.
-- This gives a secure-deny default with no additional guards needed.

-- ── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- FORCE ensures the table owner is also subject to policies (superusers are
-- always exempt in Postgres regardless of this flag; rely on the app role
-- being a non-superuser in production).
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- ── Drop any pre-existing policies (idempotent re-run safety) ───────────────
DROP POLICY IF EXISTS documents_select ON documents;
DROP POLICY IF EXISTS documents_insert ON documents;
DROP POLICY IF EXISTS documents_update ON documents;
DROP POLICY IF EXISTS documents_delete ON documents;

-- ── SELECT: owner's rows in owner's org only ────────────────────────────────
CREATE POLICY documents_select ON documents
  FOR SELECT
  USING (
    owner_user_id = current_setting('app.user_id', true)
    AND org_id    = current_setting('app.org_id',  true)
  );

-- ── INSERT: new rows must match the session context ─────────────────────────
CREATE POLICY documents_insert ON documents
  FOR INSERT
  WITH CHECK (
    owner_user_id = current_setting('app.user_id', true)
    AND org_id    = current_setting('app.org_id',  true)
  );

-- ── UPDATE: can only touch own rows; cannot change ownership ────────────────
CREATE POLICY documents_update ON documents
  FOR UPDATE
  USING (
    owner_user_id = current_setting('app.user_id', true)
    AND org_id    = current_setting('app.org_id',  true)
  )
  WITH CHECK (
    owner_user_id = current_setting('app.user_id', true)
    AND org_id    = current_setting('app.org_id',  true)
  );

-- ── DELETE: can only remove own rows ────────────────────────────────────────
CREATE POLICY documents_delete ON documents
  FOR DELETE
  USING (
    owner_user_id = current_setting('app.user_id', true)
    AND org_id    = current_setting('app.org_id',  true)
  );

-- ── Remove default PUBLIC privileges; grant only to the app DB role ─────────
-- The migration runs as the same role the application uses (DATABASE_URL).
-- Revoking PUBLIC prevents any other role from bypassing RLS via inherited grants.
REVOKE ALL ON TABLE documents FROM PUBLIC;
DO $$
BEGIN
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE documents TO %I',
    current_user
  );
END $$;
