-- Migration 0006: LLM job leasing + patch plan storage
-- Adds lease columns to jobs for safe concurrent processing.
-- Adds patch plan / tracked output storage to drafts.

-- -------------------------------------------------------------------------
-- jobs: lease fields for atomic concurrency control
-- -------------------------------------------------------------------------

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS leased_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_owner        TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts           INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_code    TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Index for efficient concurrency cap queries: count active leased jobs
-- (status = 'processing' AND lease_expires_at > NOW()) per org/globally.
CREATE INDEX IF NOT EXISTS idx_jobs_lease_expires
  ON jobs (lease_expires_at)
  WHERE status = 'processing';

-- -------------------------------------------------------------------------
-- drafts: patch plan + tracked changes output storage
-- -------------------------------------------------------------------------

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS patch_plan           JSONB,
  ADD COLUMN IF NOT EXISTS unresolved           JSONB,
  ADD COLUMN IF NOT EXISTS model_trace          JSONB,
  ADD COLUMN IF NOT EXISTS output_docx_tracked  BYTEA;
