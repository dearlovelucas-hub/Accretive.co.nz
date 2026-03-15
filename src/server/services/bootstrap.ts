import * as crypto from "node:crypto";
import { getRepos } from "../repos/index.ts";

export const DEMO_USER = {
  id: "user_lucas",
  email: "lucas@accretive.local",
  username: "Lucas",
  displayName: "Lucas",
  role: "member" as const,
  passwordHash: "6d3407d51a937153e4df921ed5ea3b101d02a432a47ad85bf58970a758765bae"
};

export const DEMO_ADMIN_USER = {
  id: "user_admin",
  email: "admin@accretive.local",
  username: "Admin",
  displayName: "Admin",
  role: "admin" as const,
  passwordHash: "6d3407d51a937153e4df921ed5ea3b101d02a432a47ad85bf58970a758765bae"
};

function isHexString(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value);
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, expectedHash: string): boolean {
  const incomingHash = hashPassword(password);

  const incoming = Buffer.from(incomingHash, "utf8");
  const expected = Buffer.from(expectedHash, "utf8");

  if (incoming.length !== expected.length || !isHexString(incomingHash) || !isHexString(expectedHash)) {
    return false;
  }

  return crypto.timingSafeEqual(incoming, expected);
}

let initialized = false;

export async function ensureSeedData(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed command is disabled in production.");
  }

  if (initialized) {
    return;
  }

  const repos = getRepos();
  await repos.orgs.upsert({ id: "org_demo", name: "Accretive Demo" });

  await repos.users.upsert({
    ...DEMO_USER,
    orgId: "org_demo"
  });

  await repos.users.upsert({
    ...DEMO_ADMIN_USER,
    orgId: "org_demo"
  });

  await repos.entitlements.upsertByUserId(DEMO_USER.id, {
    plan: "free",
    status: "inactive"
  });

  initialized = true;
}

export function resetSeedStateForTests(): void {
  initialized = false;
}
