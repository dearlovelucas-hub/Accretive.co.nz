import type { SessionPayload } from "./auth";
import { getRepos } from "../../src/server/repos/index.ts";

export async function canAccessUserOwnedDocument(args: {
  session: SessionPayload;
  ownerUserId: string;
}): Promise<boolean> {
  const { session, ownerUserId } = args;
  if (session.userId === ownerUserId) {
    return true;
  }

  const repos = getRepos();
  const [actor, owner] = await Promise.all([repos.users.findById(session.userId), repos.users.findById(ownerUserId)]);

  if (!actor || !owner || !actor.orgId || !owner.orgId) {
    return false;
  }

  if (actor.orgId !== owner.orgId) {
    return false;
  }

  return actor.role === "admin";
}
