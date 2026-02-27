import { getSessionFromRequest, type SessionPayload } from "./auth.ts";
import { getRepos } from "../../src/server/repos/index.ts";

export type { SessionPayload };

export type OrgSessionResult =
  | { ok: true; session: SessionPayload; orgId: string }
  | { ok: false; response: Response };

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

/**
 * Authenticate request and resolve the caller's org ID.
 * Returns { ok: true, session, orgId } on success.
 * Returns { ok: false, response } with a 401/403 response on failure.
 */
export async function requireOrgSession(request: Request): Promise<OrgSessionResult> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: jsonResponse({ error: "Unauthorized" }, 401)
    };
  }

  const repos = getRepos();
  const user = await repos.users.findById(session.userId);

  if (!user || !user.orgId) {
    return {
      ok: false,
      response: jsonResponse({ error: "User has no organisation." }, 403)
    };
  }

  return { ok: true, session, orgId: user.orgId };
}
