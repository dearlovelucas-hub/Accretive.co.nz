import { NextResponse } from "next/server.js";
import { getAuthCookieName, getSessionFromRequest, type SessionPayload } from "./auth.ts";
import { isRoleAllowed, type AuthRole, type ResourceAction, type ResourceType } from "./policy.ts";
import { getRepos } from "../../src/server/repos/index.ts";
import type {
  DocumentRecord,
  DraftOutputRecord,
  JobRecord,
  MatterRecord,
  TemplateRecord
} from "../../src/server/repos/contracts.ts";

export type AuthContext = {
  session: SessionPayload;
  userId: string;
  orgId: string;
  role: AuthRole;
};

type GuardFailure = { ok: false; response: NextResponse };
type GuardSuccess<T> = { ok: true; value: T };
type GuardResult<T> = GuardFailure | GuardSuccess<T>;

type ResourceResultMap = {
  document: DocumentRecord;
  template: TemplateRecord;
  job: JobRecord;
  matter: MatterRecord;
  draft_output: DraftOutputRecord;
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function deniedResponse(status: 401 | 403 | 404, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function unauthorizedResponse(): NextResponse {
  return deniedResponse(401, "Unauthorized");
}

export function forbiddenResponse(): NextResponse {
  return deniedResponse(403, "Forbidden");
}

export function notFoundResponse(): NextResponse {
  return deniedResponse(404, "Not found.");
}

function toSafeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function buildAllowedOrigins(request: Request): Set<string> {
  const allowed = new Set<string>();

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (host) {
    const protocol = forwardedProto ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    allowed.add(`${protocol}://${host}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const origin = toSafeOrigin(appUrl);
    if (origin) {
      allowed.add(origin);
    }
  }

  return allowed;
}

export function buildSensitiveHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

export function logDeniedAccess(input: {
  userId?: string;
  orgId?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  action?: ResourceAction;
  reason: string;
}): void {
  const event = {
    at: new Date().toISOString(),
    userId: input.userId ?? "anonymous",
    orgId: input.orgId ?? "unknown",
    resourceType: input.resourceType ?? "unknown",
    resourceId: input.resourceId ?? "unknown",
    action: input.action ?? "read",
    reason: input.reason
  };

  // Never include document content, session tokens, or raw headers.
  console.warn("[authz-denied]", JSON.stringify(event));
}

export function requireSession(request: Request): GuardResult<SessionPayload> {
  const session = getSessionFromRequest(request);
  if (!session) {
    logDeniedAccess({ reason: "missing_or_invalid_session" });
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, value: session };
}

export async function requireOrgMembership(request: Request): Promise<GuardResult<AuthContext>> {
  const sessionResult = requireSession(request);
  if (!sessionResult.ok) {
    return sessionResult;
  }

  const repos = getRepos();
  const user = await repos.users.findById(sessionResult.value.userId);

  if (!user || !user.orgId) {
    logDeniedAccess({
      userId: sessionResult.value.userId,
      reason: "missing_user_or_org_membership"
    });
    return { ok: false, response: forbiddenResponse() };
  }

  const role = user.role;
  if (role !== "admin" && role !== "member") {
    logDeniedAccess({
      userId: user.id,
      orgId: user.orgId,
      reason: "invalid_role"
    });
    return { ok: false, response: forbiddenResponse() };
  }

  return {
    ok: true,
    value: {
      session: sessionResult.value,
      userId: user.id,
      orgId: user.orgId,
      role
    }
  };
}

export function requireRole(context: AuthContext, allowedRoles: readonly AuthRole[]): GuardResult<true> {
  if (!allowedRoles.includes(context.role)) {
    logDeniedAccess({
      userId: context.userId,
      orgId: context.orgId,
      reason: "insufficient_role"
    });
    return { ok: false, response: forbiddenResponse() };
  }

  return { ok: true, value: true };
}

export function requireCsrfProtection(request: Request): GuardResult<true> {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return { ok: true, value: true };
  }

  const authCookieName = getAuthCookieName();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasSessionCookie = cookieHeader.includes(`${authCookieName}=`);
  if (!hasSessionCookie) {
    return { ok: true, value: true };
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    logDeniedAccess({ reason: `csrf_rejected_sec_fetch_site:${secFetchSite}` });
    return { ok: false, response: forbiddenResponse() };
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      logDeniedAccess({ reason: "csrf_missing_origin" });
      return { ok: false, response: forbiddenResponse() };
    }
    return { ok: true, value: true };
  }

  const originValue = toSafeOrigin(origin);
  if (!originValue) {
    logDeniedAccess({ reason: "csrf_invalid_origin" });
    return { ok: false, response: forbiddenResponse() };
  }

  const allowedOrigins = buildAllowedOrigins(request);
  if (!allowedOrigins.has(originValue)) {
    logDeniedAccess({ reason: "csrf_origin_mismatch" });
    return { ok: false, response: forbiddenResponse() };
  }

  return { ok: true, value: true };
}

export async function requireResourceAccess<T extends keyof ResourceResultMap>(
  context: AuthContext,
  resourceType: T,
  resourceId: string,
  action: ResourceAction
): Promise<GuardResult<ResourceResultMap[T]>> {
  if (!resourceId || typeof resourceId !== "string") {
    logDeniedAccess({
      userId: context.userId,
      orgId: context.orgId,
      resourceType,
      action,
      reason: "empty_resource_id"
    });
    return { ok: false, response: notFoundResponse() };
  }

  if (!isRoleAllowed(resourceType, action, context.role)) {
    logDeniedAccess({
      userId: context.userId,
      orgId: context.orgId,
      resourceType,
      resourceId,
      action,
      reason: "policy_denied"
    });
    return { ok: false, response: forbiddenResponse() };
  }

  const repos = getRepos();

  if (resourceType === "document") {
    const doc = await repos.documents.getByIdForOrg(resourceId, context.orgId);
    if (!doc) {
      return { ok: false, response: notFoundResponse() };
    }

    if (context.role !== "admin" && doc.ownerUserId !== context.userId) {
      logDeniedAccess({
        userId: context.userId,
        orgId: context.orgId,
        resourceType,
        resourceId,
        action,
        reason: "document_owner_mismatch"
      });
      return { ok: false, response: notFoundResponse() };
    }

    return { ok: true, value: doc as ResourceResultMap[T] };
  }

  if (resourceType === "template") {
    const template = await repos.templates.findByIdForOrg(resourceId, context.orgId);
    if (!template || template.ownerUserId !== context.userId) {
      if (template) {
        logDeniedAccess({
          userId: context.userId,
          orgId: context.orgId,
          resourceType,
          resourceId,
          action,
          reason: "template_owner_mismatch"
        });
      }
      return { ok: false, response: notFoundResponse() };
    }

    return { ok: true, value: template as ResourceResultMap[T] };
  }

  if (resourceType === "job") {
    const job = await repos.jobs.getByIdForOrg(resourceId, context.orgId);
    if (!job) {
      return { ok: false, response: notFoundResponse() };
    }

    if (context.role !== "admin" && job.ownerUserId !== context.userId) {
      if (job) {
        logDeniedAccess({
          userId: context.userId,
          orgId: context.orgId,
          resourceType,
          resourceId,
          action,
          reason: "job_owner_mismatch"
        });
      }
      return { ok: false, response: notFoundResponse() };
    }

    return { ok: true, value: job as ResourceResultMap[T] };
  }

  if (resourceType === "matter") {
    const matter = await repos.matters.findByIdAndOrg(resourceId, context.orgId);
    if (!matter) {
      return { ok: false, response: notFoundResponse() };
    }

    return { ok: true, value: matter as ResourceResultMap[T] };
  }

  const output = await repos.draftOutputs.getByJobIdForOrg(resourceId, context.orgId);
  if (!output) {
    return { ok: false, response: notFoundResponse() };
  }

  const job = await repos.jobs.getByIdForOrg(resourceId, context.orgId);
  if (!job) {
    return { ok: false, response: notFoundResponse() };
  }

  if (context.role !== "admin" && job.ownerUserId !== context.userId) {
    if (job) {
      logDeniedAccess({
        userId: context.userId,
        orgId: context.orgId,
        resourceType,
        resourceId,
        action,
        reason: "draft_output_owner_mismatch"
      });
    }
    return { ok: false, response: notFoundResponse() };
  }

  return { ok: true, value: output as ResourceResultMap[T] };
}
