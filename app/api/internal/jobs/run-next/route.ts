import { NextRequest, NextResponse } from "next/server";
import { runQueuedJobs } from "@/lib/server/jobRunner";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): { ok: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim();

  if (cronSecret || internalSecret) {
    const authHeader = request.headers.get("authorization");
    const internalHeader = request.headers.get("x-internal-jobs-secret");

    const cronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
    const internalAuthorized = Boolean(internalSecret && internalHeader === internalSecret);

    if (!cronAuthorized && !internalAuthorized) {
      return { ok: false, reason: "Invalid runner credentials." };
    }

    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      reason: "Missing CRON_SECRET or INTERNAL_JOBS_SECRET in production."
    };
  }

  return { ok: true };
}

function parseMaxJobs(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("maxJobs");
  const parsed = Number(raw ?? "2");
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

async function run(request: NextRequest): Promise<NextResponse> {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    const status = process.env.NODE_ENV === "production" ? 401 : 400;
    return NextResponse.json({ error: auth.reason ?? "Unauthorized." }, { status });
  }

  const maxJobs = parseMaxJobs(request);
  const summary = await runQueuedJobs({
    maxJobs,
    source: "internal-runner"
  });

  return NextResponse.json(summary, { status: 200 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request);
}
