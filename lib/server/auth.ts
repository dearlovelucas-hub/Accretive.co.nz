import * as crypto from "node:crypto";
import { getEnv } from "../../src/server/env.ts";
import { getRepos } from "../../src/server/repos/index.ts";
import type { UserRecord } from "../../src/server/repos/contracts.ts";
import { ensureSeedData, verifyPassword } from "../../src/server/services/bootstrap.ts";

const AUTH_COOKIE_NAME = "accretive_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
export type SessionPayload = {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string): string {
  const env = getEnv();
  const sessionSecret = env.SESSION_SECRET;
  return crypto.createHmac("sha256", sessionSecret).update(encodedPayload).digest("base64url");
}

export async function verifyUserCredentials(username: string, password: string): Promise<UserRecord | null> {
  await ensureSeedData();
  const repos = getRepos();
  const user = await repos.users.findByUsername(username);
  if (!user) {
    return null;
  }

  if (!user.passwordHash) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export function createSessionToken(user: Pick<UserRecord, "id" | "username" | "displayName" | "role">): string {
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = signPayload(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  return parseSessionToken(token);
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getSessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}
