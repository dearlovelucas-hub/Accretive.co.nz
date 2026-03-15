# Backend Docs

## Scope

Backend code in this project handles auth, billing, draft generation, queue processing, data persistence, and document storage.

- API handlers: `app/api/*`
- Server modules: `lib/server/*`
- Database and repositories: `src/server/*`
- SQL migrations: `db/migrations/*`
- Scripts: `scripts/run-migrations.mjs`, `scripts/seed-demo.mjs`

## API Surface

- Auth: `/api/auth/*`
- Demo requests: `/api/demo-requests`
- Draft jobs: `/api/draft-jobs/*`
- Documents: `/api/documents/*`
- Templates: `/api/templates/*`
- Billing: `/api/billing/*`
- Activity and matter workflows: `/api/activity`, `/api/matters/*`, `/api/jobs/*`
- Internal worker: `/api/internal/jobs/run-next`
- Internal config validation: `/api/internal/config-check`

## Required Runtime Environment

See `.env.example`.

Required in all environments:

- `DATABASE_URL` (or `DATABASE_URL_TEST` for tests)
- `SESSION_SECRET`

Required in production:

- `BILLING_WEBHOOK_SECRET`
- At least one of:
  - `CRON_SECRET`
  - `INTERNAL_JOBS_SECRET`

Operational controls:

- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` (default `5`)
- `LOGIN_RATE_LIMIT_WINDOW_MS` (default `600000`)
- `ACCRETIVE_DB_RATE_LIMIT_MAX_REQUESTS`
- `ACCRETIVE_DB_RATE_LIMIT_WINDOW_MS`

## Auth and Worker Contracts

`POST /api/auth/login`

- Returns `429` with `Retry-After` after repeated failed attempts per `username + IP`.
- Successful login clears the lockout state for that key.

`POST /api/billing/webhook`

- In production, missing `BILLING_WEBHOOK_SECRET` returns `500` misconfiguration.
- If secret is set, missing/invalid `x-billing-signature` returns `401`.

`GET|POST /api/internal/jobs/run-next`

- Auth accepted:
  - `Authorization: Bearer $CRON_SECRET`
  - `x-internal-jobs-secret: $INTERNAL_JOBS_SECRET`
- In production, missing both worker secrets returns `500` misconfiguration.
- Invalid credentials return `401`.
- Response includes run stats and timing fields.
- Structured logs include `runId`, request source, outcome, and failure-step details.

## Upload Limits and Validation

All multipart endpoints return:

- `413` for file-size violations
- `400` for invalid file type/count/form field structure

`POST /api/templates`

- `templateFile`: exactly `1`
- Allowed types: `.docx`
- Max file size: `20 MB`

`POST /api/draft-jobs`

- `templateFile`: exactly `1` (`.docx`, max `20 MB`)
- `transactionFiles`: `1..10` files (`.docx`, `.pdf`, `.txt`, each max `25 MB`)
- `termSheet`: optional, `0..1` (`.docx`, `.pdf`, `.txt`, max `20 MB`)

`POST /api/matters/:matterId/uploads`

- `kind=PRECEDENT`: exactly `1`, allowed `.docx`, `.pdf`, max `50 MB`
- `kind=TERMSHEET`: exactly `1`, allowed `.docx`, `.pdf`, `.txt`, max `50 MB`

## Seeding Policy

Demo/user bootstrap is no longer executed in live request paths.

- Runtime paths do not auto-create seed users.
- Dev/test demo data is explicit:

```bash
npm run db:seed-demo
```

The seed command is blocked in production.

## Testing Against Vercel Test DB Branch

You can run the Node test suite against a remote Vercel/Neon branch DB by using a dedicated env file:

```bash
cp env.test-branch.example .env.test-branch
# set DATABASE_URL_TEST to the branch connection string
npm run test:vercel-db
```

Important:

- Tests run with `NODE_ENV=test`.
- Migrations are applied automatically for the test target.
- Test helpers truncate core tables between test cases, so always use a dedicated test branch/database.
- `ACCRETIVE_DB_SCHEMA` can be set in `.env.test-branch` for extra isolation.

## Operations and Runbooks

### Internal MVP Release Checklist

1. Apply migrations:
   - `npm run db:migrate`
2. Set production secrets:
   - `SESSION_SECRET`
   - `BILLING_WEBHOOK_SECRET`
   - `CRON_SECRET` and/or `INTERNAL_JOBS_SECRET`
3. Verify config:
   - `GET /api/internal/config-check` returns `200` and `ok: true`.
4. Smoke-test critical paths:
   - Login (`/api/auth/login`)
   - Draft job create/poll/result/download (`/api/draft-jobs/*`)
   - Template upload/list (`/api/templates`)
   - Billing webhook (`/api/billing/webhook`)
   - Runner trigger (`/api/internal/jobs/run-next`)
5. Confirm logs:
   - runner request logs include `runId`, source, timing, counts, and outcomes.
6. Rollback readiness:
   - previous deploy artifact available
   - migration rollback strategy reviewed (or forward-fix plan documented)
   - cron disable switch confirmed if queue issues appear

### Known Failure Responses

- `/api/auth/login`: `400`, `401`, `429`
- `/api/billing/webhook`: `400`, `401`, `500`
- `/api/internal/jobs/run-next`: `401`, `500`
- Multipart uploads: `400`, `413`
