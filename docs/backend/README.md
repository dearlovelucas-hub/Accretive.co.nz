# Backend Docs

## Scope

Backend code in this project handles auth, billing, draft generation, data persistence, and document storage:

- API handlers: `app/api/*`
- Server modules: `lib/server/*`
- Database and repositories: `src/server/*`
- SQL migrations: `db/migrations/*`
- Migration tooling: `scripts/run-migrations.mjs`

## API Surface

- Auth: `/api/auth/*`
- Demo requests: `/api/demo-requests`
- Draft jobs: `/api/draft-jobs/*`
- Documents: `/api/documents/*`
- Templates: `/api/templates/*`
- Billing: `/api/billing/*`
- Activity and matter workflows: `/api/activity`, `/api/matters/*`, `/api/jobs/*`

## Data Layer

- Postgres schema changes live in `db/migrations/*`
- Repo interfaces and implementations live in `src/server/repos/*`
- Core services and environment parsing live in `src/server/services/*` and `src/server/env.ts`

## Environment Variables

See `.env.example` for required values:

- `DATABASE_URL`
- `DATABASE_URL_TEST`
- `SESSION_SECRET`
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BILLING_WEBHOOK_SECRET`
- `BILLING_STUB_AUTO_ACTIVATE`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_BASE_PATH`

## Dashboard UI Draft

Backend-facing dashboard scope and API contracts are documented in:

- `docs/backend/dashboard-ui-draft.md`
