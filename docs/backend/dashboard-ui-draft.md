# Dashboard UI Draft (Backend-Oriented)

## Goal

Define a backend-ready dashboard UI contract so frontend screens can be delivered without changing API semantics later.

## Proposed Screens

- `Dashboard Home`: summary cards for jobs, templates, and subscription status.
- `Drafting Workspace`: upload template/docs, track job status, preview output.
- `Documents`: list generated documents with download actions.
- `Templates`: list and upload templates.
- `Activity`: timeline of important drafting and billing events.

## Core Data Contracts

- Authenticated user context:
  - `GET /api/auth/me`
- Dashboard summary:
  - `GET /api/activity`
  - `GET /api/billing/status`
- Drafting:
  - `POST /api/draft-jobs`
  - `GET /api/draft-jobs/:jobId`
  - `GET /api/draft-jobs/:jobId/result`
  - `GET /api/draft-jobs/:jobId/trace`
  - `GET /api/draft-jobs/:jobId/download`
- Documents:
  - `GET /api/documents`
  - `GET /api/documents/:documentId`
  - `GET /api/documents/:documentId/download`
- Templates:
  - `GET /api/templates`
  - `POST /api/templates`

## UI State Model

- `idle`: default view with form controls enabled.
- `submitting`: uploads or create-job request in progress.
- `processing`: polling current draft job until completion.
- `ready`: full output and document download available.
- `error`: recoverable request or validation failure.

## Backend Notes

- Keep document visibility enforced via repository filters and RLS.
- Return stable response shapes to avoid frontend refactors.
