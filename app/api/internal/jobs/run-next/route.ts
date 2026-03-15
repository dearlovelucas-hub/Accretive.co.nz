import * as crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import { runQueuedJobs } from "@/lib/server/jobRunner";
import { validateInternalRunnerAuth } from "@/lib/server/internalRunnerAuth";
import { getCriticalProductionEnvIssues } from "@/src/server/env";

export const runtime = "nodejs";
export const maxDuration = 300;

function detectRequestSource(request: NextRequest): string {
  if (request.headers.get("x-vercel-cron")) {
    return "vercel-cron";
  }
  if (request.headers.get("x-internal-jobs-secret")) {
    return "manual-internal-header";
  }
  if (request.headers.get("authorization")) {
    return "manual-bearer";
  }
  return "manual-local";
}

function logRunnerRouteEvent(level: "info" | "warn" | "error", event: string, payload: Record<string, unknown>): void {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...payload
  });

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
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
  const runId = crypto.randomUUID();
  const requestSource = detectRequestSource(request);

  const configIssues = getCriticalProductionEnvIssues("internal-runner");
  if (configIssues.length > 0) {
    logRunnerRouteEvent("error", "runner.config.missing", {
      runId,
      requestSource,
      missing: configIssues.map((issue) => issue.key)
    });
    return NextResponse.json(
      {
        error: "Runner is misconfigured.",
        missing: configIssues.map((issue) => issue.key)
      },
      { status: 500 }
    );
  }

  const auth = validateInternalRunnerAuth(request);
  if (!auth.ok) {
    logRunnerRouteEvent("warn", "runner.auth.denied", {
      runId,
      requestSource,
      code: auth.code
    });
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const maxJobs = parseMaxJobs(request);
  logRunnerRouteEvent("info", "runner.request.start", {
    runId,
    requestSource,
    method: auth.method,
    maxJobs
  });

  try {
    const summary = await runQueuedJobs({
      maxJobs,
      source: requestSource,
      runId
    });

    const failedJobs = summary.failed;
    const outcome = failedJobs > 0 ? "partial_failure" : "ok";
    logRunnerRouteEvent("info", "runner.request.finish", {
      runId,
      requestSource,
      method: auth.method,
      durationMs: summary.durationMs,
      backlogBefore: summary.backlog.before,
      backlogAfter: summary.backlog.after,
      claimed: summary.claimed,
      processed: summary.processed,
      failed: summary.failed,
      skipped: summary.skipped,
      outcome
    });

    return NextResponse.json({ ...summary, runId }, { status: 200 });
  } catch (error) {
    logRunnerRouteEvent("error", "runner.request.error", {
      runId,
      requestSource,
      method: auth.method,
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return NextResponse.json({ error: "Runner execution failed.", runId }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request);
}
