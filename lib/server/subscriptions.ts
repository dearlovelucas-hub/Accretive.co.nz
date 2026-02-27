import { getRepos } from "../../src/server/repos/index.ts";
import { ensureSeedData } from "../../src/server/services/bootstrap.ts";

export type SubscriptionRecord = {
  userId: string;
  plan: string;
  status: "active" | "inactive";
  expiresAt?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
};

export async function getEntitlement(userId: string): Promise<{ active: boolean; plan: string; expiresAt?: string }> {
  await ensureSeedData();
  const repos = getRepos();
  const record = await repos.entitlements.getByUserId(userId);

  if (!record) {
    return { active: false, plan: "free" };
  }

  const isExpired = record.expiresAt ? Date.parse(record.expiresAt) < Date.now() : false;
  const active = record.status === "active" && !isExpired;

  return {
    active,
    plan: active ? record.plan : "free",
    expiresAt: record.expiresAt
  };
}

export async function setSubscriptionForUser(
  userId: string,
  input: Omit<SubscriptionRecord, "userId">
): Promise<SubscriptionRecord> {
  await ensureSeedData();
  const repos = getRepos();
  const next = await repos.entitlements.upsertByUserId(userId, {
    plan: input.plan,
    status: input.status,
    expiresAt: input.expiresAt,
    providerCustomerId: input.providerCustomerId,
    providerSubscriptionId: input.providerSubscriptionId
  });

  return {
    userId: next.userId,
    plan: next.plan,
    status: next.status,
    expiresAt: next.expiresAt,
    providerCustomerId: next.providerCustomerId,
    providerSubscriptionId: next.providerSubscriptionId
  };
}

export async function getSubscriptionForUser(userId: string): Promise<SubscriptionRecord | null> {
  await ensureSeedData();
  const repos = getRepos();
  const record = await repos.entitlements.getByUserId(userId);
  if (!record) {
    return null;
  }

  return {
    userId: record.userId,
    plan: record.plan,
    status: record.status,
    expiresAt: record.expiresAt,
    providerCustomerId: record.providerCustomerId,
    providerSubscriptionId: record.providerSubscriptionId
  };
}
