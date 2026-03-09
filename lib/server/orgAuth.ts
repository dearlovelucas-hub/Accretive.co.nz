import { requireOrgMembership } from "./authorization.ts";
import type { SessionPayload } from "./auth.ts";

export type { SessionPayload };

export type OrgSessionResult =
  | { ok: true; session: SessionPayload; orgId: string }
  | { ok: false; response: Response };

/**
 * Authenticate request and resolve the caller's org ID.
 * Returns { ok: true, session, orgId } on success.
 * Returns { ok: false, response } with a 401/403 response on failure.
 */
export async function requireOrgSession(request: Request): Promise<OrgSessionResult> {
  const membership = await requireOrgMembership(request);
  if (!membership.ok) {
    return {
      ok: false,
      response: membership.response
    };
  }

  return { ok: true, session: membership.value.session, orgId: membership.value.orgId };
}
