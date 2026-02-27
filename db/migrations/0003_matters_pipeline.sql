-- Make draft_id nullable so precedent-pipeline jobs can exist without a draft record.
-- PostgreSQL allows multiple NULLs in a UNIQUE column so the UNIQUE constraint is kept.
ALTER TABLE jobs ALTER COLUMN draft_id DROP NOT NULL;

-- matters: top-level container for a deal / transaction
CREATE TABLE IF NOT EXISTS matters (
  id          TEXT      PRIMARY KEY,
  org_id      TEXT      NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     TEXT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- matter_uploads: precedent DOCX and term sheet files belonging to a matter
CREATE TABLE IF NOT EXISTS matter_uploads (
  id          TEXT      PRIMARY KEY,
  matter_id   TEXT      NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  org_id      TEXT      NOT NULL,
  user_id     TEXT      NOT NULL,
  kind        TEXT      NOT NULL CHECK (kind IN ('PRECEDENT', 'TERMSHEET')),
  filename    TEXT      NOT NULL,
  mime_type   TEXT      NOT NULL,
  size_bytes  INTEGER   NOT NULL,
  sha256      TEXT      NOT NULL,
  storage_key TEXT      NOT NULL,
  retained    BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- draft_outputs: persisted output DOCX files produced by the precedent pipeline
CREATE TABLE IF NOT EXISTS draft_outputs (
  id          TEXT      PRIMARY KEY,
  job_id      TEXT      NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  org_id      TEXT      NOT NULL,
  storage_key TEXT      NOT NULL,
  filename    TEXT      NOT NULL,
  mime_type   TEXT      NOT NULL,
  size_bytes  INTEGER   NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- extraction_cache: caches Claude deal-context extraction per term-sheet upload
CREATE TABLE IF NOT EXISTS extraction_cache (
  id             TEXT      PRIMARY KEY,
  upload_id      TEXT      NOT NULL REFERENCES matter_uploads(id) ON DELETE CASCADE,
  extracted_text TEXT,
  extracted_json TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link jobs to their parent matter (nullable; existing jobs without matters are unaffected)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS matter_id TEXT REFERENCES matters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matters_org_id_idx              ON matters(org_id);
CREATE INDEX IF NOT EXISTS matter_uploads_matter_kind_idx  ON matter_uploads(matter_id, kind);
CREATE INDEX IF NOT EXISTS draft_outputs_job_id_idx        ON draft_outputs(job_id);
CREATE INDEX IF NOT EXISTS extraction_cache_upload_id_idx  ON extraction_cache(upload_id);
CREATE INDEX IF NOT EXISTS jobs_matter_id_idx              ON jobs(matter_id);
