import { NextRequest, NextResponse } from "next/server.js";
import { validateInternalRunnerAuth } from "@/lib/server/internalRunnerAuth";
import { getCriticalProductionEnvIssues } from "@/src/server/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const issues = getCriticalProductionEnvIssues("startup");
  const auth = validateInternalRunnerAuth(request);

  if (!auth.ok && auth.code !== "missing_runner_secret") {
    return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
  }

  if (issues.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        nodeEnv: process.env.NODE_ENV ?? "development",
        missing: issues.map((issue) => issue.key),
        details: issues.map((issue) => issue.message)
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      nodeEnv: process.env.NODE_ENV ?? "development"
    },
    { status: 200 }
  );
}
