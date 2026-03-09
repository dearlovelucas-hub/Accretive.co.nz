# Accretive Marketing Web App

Production-ready marketing site for Accretive built with Next.js App Router, TypeScript, and Tailwind CSS.

## Documentation Split

- Frontend docs: `docs/frontend/README.md`
- Backend docs: `docs/backend/README.md`

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- `next/font` with Cormorant Garamond for primary typography and wordmark

## Routes

- `/` Home
- `/request-demo`
- `/our-product`
- `/login`
- `/dashboard/*` (authenticated client workspace)

## Backend (MVP)

Route handlers are implemented with Next.js App Router APIs:

- `POST /api/demo-requests` validates and stores demo requests in Postgres
- `GET /api/demo-requests` lists persisted demo requests
- `POST /api/draft-jobs` accepts `multipart/form-data` (template, transaction docs, deal info) and starts a generation job
- `GET /api/draft-jobs/:jobId` returns job status/progress
- `GET /api/draft-jobs/:jobId/result` returns generated text result
- `GET /api/draft-jobs/:jobId/download` returns full `.docx` output
- `GET /api/draft-jobs/:jobId/trace` returns per-job review trace (prompt metadata + step outputs)
- `GET /api/documents` returns current user's generated draft jobs for dashboard documents
- `GET /api/documents/:documentId` returns a single visible document (owner/member or org-admin policy)
- `GET /api/documents/:documentId/download` downloads a visible generated document
- `GET /api/templates` returns current user's template list
- `POST /api/templates` uploads/creates a template record for current user
- `POST /api/auth/login` signs a user in and sets an HTTP-only session cookie
- `GET /api/auth/me` returns the current authenticated session state
- `POST /api/auth/logout` clears session cookie
- `POST /api/billing/create-checkout-session` creates billing checkout URL (stub or provider integration point)
- `POST /api/billing/webhook` updates subscription state from billing events

Draft generation requires at least one transaction document server-side; optional term sheet is supported.

Entitlement helper:

- `getEntitlement(userId) -> { active, plan, expiresAt? }` in `lib/server/subscriptions.ts`

Demo login account:

- Username: `Lucas`
- Password: `accretive123`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create local databases (one-time):

```bash
createdb accretive_dev
createdb accretive_test
```

3. Run migrations:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/accretive_dev npm run db:migrate
```

4. Start development server:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

6. Run tests:

```bash
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/accretive_test npm run test
```

Or if `DATABASE_URL_TEST` is already in your environment:

```bash
npm run test
```

## Build for production

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push this project to GitHub.
2. In Vercel, click **Add New Project** and import the repository.
3. Keep default framework settings (Next.js).
4. Click **Deploy**.

## Connect `accretive.co.nz` from GoDaddy to Vercel

1. In Vercel project settings, go to **Domains** and add `accretive.co.nz` and `www.accretive.co.nz`.
2. In GoDaddy DNS, create/update records:
   - `A` record for `@` pointing to `76.76.21.21`
   - `CNAME` record for `www` pointing to `cname.vercel-dns.com`
3. Remove conflicting old records for `@` and `www`.
4. Wait for DNS propagation, then verify domains in Vercel.

## Notes

- Demo request form now submits to `POST /api/demo-requests`.
- Upload demo on `/our-product` now creates and polls a real backend draft job.
- Logged-in users access the app workspace at `/dashboard/*`.

## Billing Setup (Stub + Provider Hook Points)

Environment variables are documented in `.env.example`:

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
- `STORAGE_PROVIDER` (`database` recommended on Vercel)
- `CRON_SECRET` (recommended for `/api/internal/jobs/run-next` cron auth)
- `INTERNAL_JOBS_SECRET` (optional manual runner trigger secret)
- `ACCRETIVE_DB_SCHEMA` (optional, useful for test isolation)
- `ACCRETIVE_DB_RATE_LIMIT_MAX_REQUESTS` (optional, defaults to `10`, set `0` to disable)
- `ACCRETIVE_DB_RATE_LIMIT_WINDOW_MS` (optional, defaults to `86400000` = 24h)

LLM generation:

- Draft generation now uses Claude via `@anthropic-ai/sdk` in `lib/server/llmDrafting.ts`.
- If `ANTHROPIC_API_KEY` is missing, the backend returns a deterministic fallback draft instead of live LLM output.
- Dashboard Drafting now shows a review trace panel (context, required fields, missing questions, final draft step).

Local webhook test example:

```bash
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "Content-Type: application/json" \
  -H "x-billing-signature: $BILLING_WEBHOOK_SECRET" \
  -d '{"type":"checkout.session.completed","data":{"userId":"user_lucas","plan":"pro"}}'
```

Migrations:

- `db/migrations/0001_create_subscriptions.sql`
- `db/migrations/0002_create_core_tables.sql`
- `db/migrations/0003_matters_pipeline.sql`
- `db/migrations/0004_multi_tenant_documents.sql`
- `db/migrations/0005_rls_document_isolation.sql`
- `db/migrations/0006_llm_leasing.sql`
- `db/migrations/0007_serverless_runtime.sql`
- Runner: `npm run db:migrate`

Serverless job runner (Vercel):

- Queue worker endpoint: `GET|POST /api/internal/jobs/run-next`
- Vercel cron is configured in `vercel.json` to call it every minute.
- In production, set `CRON_SECRET` (or `INTERNAL_JOBS_SECRET`) so the worker endpoint is authenticated.

Document isolation:

- Document table access is restricted by PostgreSQL RLS policies in migration `0005`.
- Document queries should run through `withDocumentSession(userId, orgId, fn)` in `src/server/db/index.ts`.
# Accretive
