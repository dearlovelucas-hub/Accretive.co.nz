CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_file_name TEXT NOT NULL,
  transaction_file_names TEXT[] NOT NULL DEFAULT '{}',
  term_sheet_file_name TEXT,
  deal_info TEXT NOT NULL,
  generated_output TEXT NOT NULL DEFAULT '',
  prompt_version TEXT,
  prompt_hash TEXT,
  prompt_preview TEXT,
  llm_model TEXT,
  trace_steps JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE REFERENCES drafts(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_id TEXT REFERENCES drafts(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  content BYTEA NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organisation TEXT NOT NULL,
  role TEXT NOT NULL,
  practice_areas TEXT[] NOT NULL DEFAULT '{}',
  firm_size TEXT NOT NULL,
  doc_types TEXT NOT NULL,
  current_process TEXT NOT NULL,
  security_requirements TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL,
  consent BOOLEAN NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_user_id_unique'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_org_id_idx ON users(org_id);
CREATE INDEX IF NOT EXISTS templates_owner_user_id_idx ON templates(owner_user_id);
CREATE INDEX IF NOT EXISTS drafts_owner_user_id_idx ON drafts(owner_user_id);
CREATE INDEX IF NOT EXISTS jobs_owner_user_id_idx ON jobs(owner_user_id);
CREATE INDEX IF NOT EXISTS uploads_draft_id_idx ON uploads(draft_id);
CREATE INDEX IF NOT EXISTS uploads_template_id_idx ON uploads(template_id);
CREATE INDEX IF NOT EXISTS demo_requests_submitted_at_idx ON demo_requests(submitted_at DESC);
