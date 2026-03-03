# Frontend Docs

## Scope

Frontend code in this project is everything needed to render the public website and user-facing dashboard UI:

- `app/` pages and layouts, excluding `app/api/*`
- `components/`
- `public/`
- `app/globals.css`
- frontend build config (`next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`)

## Route Structure

- Public marketing pages: `app/page.tsx`, `app/our-product/page.tsx`, `app/pricing/page.tsx`, `app/request-demo/page.tsx`
- Supporting legal pages: `app/(frontend)/*`
- Auth page: `app/login/page.tsx`
- News pages: `app/news-and-releases/*`
- Dashboard UI pages: `app/dashboard/*`

## Component Structure

- Shared marketing UI: `components/*.tsx`
- Authenticated workspace UI: `components/dashboard/*.tsx`

## Frontend API Contracts

The frontend calls these routes (implemented in backend docs):

- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/demo-requests`
- `/api/draft-jobs`
- `/api/draft-jobs/:jobId`
- `/api/draft-jobs/:jobId/result`
- `/api/draft-jobs/:jobId/download`
- `/api/draft-jobs/:jobId/trace`
- `/api/documents`
- `/api/documents/:documentId`
- `/api/documents/:documentId/download`
- `/api/templates`
- `/api/billing/create-checkout-session`
- `/api/billing/status`

## Frontend-Only Repo Export

A frontend-only repository snapshot has been prepared at:

- `/tmp/Accretive.co.nz`

It contains UI code and config, with backend-only code excluded.
