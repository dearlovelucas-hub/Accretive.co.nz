CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS sha256 TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'templates'
      AND column_name = 'upload_id'
  ) THEN
    INSERT INTO storage_blobs (key, content)
    SELECT
      CONCAT('templates/', t.id, '/', regexp_replace(u.file_name, '[^A-Za-z0-9._-]+', '_', 'g')),
      u.content
    FROM templates t
    JOIN uploads u ON u.id = t.upload_id
    WHERE t.storage_key IS NULL
    ON CONFLICT (key)
    DO UPDATE SET
      content = EXCLUDED.content,
      updated_at = NOW();

    UPDATE templates t
    SET
      storage_key = CONCAT('templates/', t.id, '/', regexp_replace(u.file_name, '[^A-Za-z0-9._-]+', '_', 'g')),
      size_bytes = u.byte_size,
      sha256 = encode(digest(u.content, 'sha256'), 'hex'),
      updated_at = NOW()
    FROM uploads u
    WHERE u.id = t.upload_id
      AND t.storage_key IS NULL;
  END IF;
END $$;

ALTER TABLE templates
  ALTER COLUMN storage_key SET NOT NULL,
  ALTER COLUMN size_bytes SET NOT NULL,
  ALTER COLUMN sha256 SET NOT NULL;

ALTER TABLE matter_uploads
  ADD COLUMN IF NOT EXISTS source_template_id TEXT REFERENCES templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matter_uploads_source_template_id_idx
  ON matter_uploads(source_template_id);

DELETE FROM documents
WHERE storage_path LIKE 'draft-job:%';

DELETE FROM jobs
WHERE matter_id IS NULL;

ALTER TABLE jobs
  ALTER COLUMN matter_id SET NOT NULL;

ALTER TABLE jobs
  DROP COLUMN IF EXISTS draft_id;

ALTER TABLE templates
  DROP COLUMN IF EXISTS upload_id;

DROP TABLE IF EXISTS uploads;
DROP TABLE IF EXISTS drafts;
