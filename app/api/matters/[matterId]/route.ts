import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { buildMatterDetail } from "@/lib/server/matters";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { matterId } = await params;
  const access = await requireResourceAccess(auth.value, "matter", matterId, "read");
  if (!access.ok) {
    return access.response;
  }

  const repos = getRepos();
  const item = await buildMatterDetail(access.value, auth.value.orgId, repos);
  return NextResponse.json({ item }, { status: 200 });
}
