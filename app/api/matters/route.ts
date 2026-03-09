import * as crypto from "node:crypto";
import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const title = String((body as Record<string, unknown>).title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const repos = getRepos();
  const matter = await repos.matters.create({
    id: crypto.randomUUID(),
    orgId: auth.value.orgId,
    userId: auth.value.userId,
    title
  });

  return NextResponse.json({ id: matter.id, title: matter.title, createdAt: matter.createdAt }, { status: 201 });
}
