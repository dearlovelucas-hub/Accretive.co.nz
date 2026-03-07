-- Migration 0007: serverless-safe storage + queue scan index
-- 1) Durable blob table so Vercel runtime does not rely on local disk persistence.
-- 2) Queue scan index for selecting next queued jobs efficiently.

CREATE TABLE IF NOT EXISTS storage_blobs (
  key        TEXT PRIMARY KEY,
  content    BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx
  ON jobs (status, created_at);
