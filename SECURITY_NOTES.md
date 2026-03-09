# Security Hardening Notes

## What Was Fixed

### 1) Centralized authorization and tenancy guard
- Added `lib/server/authorization.ts` with shared guard helpers:
  - `requireSession()`
  - `requireOrgMembership()`
  - `requireRole()`
  - `requireResourceAccess()`
  - `requireCsrfProtection()`
  - `buildSensitiveHeaders()`
- Added denied-access logging with safe metadata only (`userId`, `orgId`, `resourceType`, `action`, timestamp).

### 2) Centralized permission map
- Added `lib/server/policy.ts`.
- Role/action checks are now centralized and reusable instead of duplicated route logic.

### 3) Repository/query hardening for org scope
- Added org-scoped repository methods to prevent bare-ID request handler usage:
  - `templates.listByOrg()`, `templates.findByIdForOrg()`
  - `drafts.getByIdForOrg()`
  - `uploads.listByDraftIdForOrg()`, `uploads.getByIdForOrg()`
  - `jobs.getByIdForOrg()`, `jobs.listByMatterForOrg()`
  - `draftOutputs.getByJobIdForOrg()`
  - `documents.getByIdForOrg()`
- Added explicit security comments in repo contracts:
  - “No bare resource lookup by ID in request handlers.”

### 4) Protected endpoint revalidation
- Hardened protected routes to re-check:
  - session validity,
  - org membership,
  - role/policy,
  - resource ownership/org scope.
- Cross-tenant lookups now fail closed (generic not-found/forbidden behavior).
- Covered docs/templates/drafts/draft-jobs/jobs/matters/activity/billing status/checkouts.

### 5) Download hardening
- Added sensitive download headers (`no-store`, `nosniff`, `X-Frame-Options`) via shared helper.
- Enforced fresh access checks before serving bytes for:
  - document downloads,
  - generated output downloads,
  - tracked DOCX downloads,
  - comparison PDF and related draft outputs.
- Denials return generic responses to reduce metadata leakage.

### 6) Session/cookie hardening
- Session token now includes `sid` + `iat` and is re-issued on login (token rotation on login).
- Cookie hardening:
  - `HttpOnly`
  - `SameSite=lax`
  - secure-cookie enforcement using request-aware logic (`shouldUseSecureCookies()`).
- Logout cookie now uses the same hardened attributes.

### 7) CSRF hardening for cookie-authenticated mutating routes
- Added origin + `sec-fetch-site` validation for mutating requests carrying the session cookie.
- Applied to mutating protected routes (e.g. drafts resolve/run, draft job creation, matters mutations, billing checkout, logout).

### 8) App-layer authz + RLS boundary clarity
- App-layer authorization now executes before sensitive resource access.
- DB-layer tenant controls remain as backstop; handlers no longer rely solely on DB policy behavior.

## Tests Added/Updated

- Added `tests/authz-routes.test.ts` covering:
  - cross-tenant document access blocked,
  - cross-tenant generated-output access blocked,
  - member denied admin-only action,
  - unauthorized/cross-tenant access blocked for sensitive resource checks,
  - missing/invalid session rejection,
  - empty/bare resource ID rejection by centralized guard.

## Routes Still Recommended For Manual Review

- `POST /api/auth/login`
  - Consider rate limiting / brute-force controls and account lockout policy.
- `POST /api/billing/webhook`
  - Secret verification exists; still verify replay-protection requirements with provider.
- `GET|POST /api/internal/jobs/run-next`
  - Secret gating exists; confirm production secret rotation and observability expectations.
- `POST /api/demo-requests`
  - Public by design; consider abuse controls (rate limit/captcha) if exposed broadly.

## Assumptions

- “Active membership” is currently modeled as: user exists, has valid `orgId`, and valid role (`member` or `admin`).
- Template access remains owner-scoped (including admins), matching existing behavior.
- Draft/job/document access allows org-admin visibility where policy permits; member access remains owner-scoped.
- Existing product flows and data model were preserved; hardening was implemented with minimal architecture changes.

