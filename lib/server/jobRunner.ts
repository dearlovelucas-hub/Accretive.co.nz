import * as crypto from "node:crypto";
import { query } from "@/src/server/db";
import { getRepos } from "@/src/server/repos";
import { failJobAndReleaseLease, tryClaimLease } from "@/src/server/llm/leasing";
import { processPrecedentJob } from "./precedentPipeline";

export type JobRunnerSummary = {
  source: string;
  runId?: string;
  maxJobs: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  backlog: {
    before: number;
    after: number;
  };
  scanned: number;
  claimed: number;
  processed: number;
  failed: number;
  skipped: {
    notClaimable: number;
    capped: number;
    maxAttempts: number;
  };
};

type QueueCandidateRow = { id: string };
type QueueCountRow = { count: string };

function logRunnerEvent(level: "info" | "warn" | "error", event: string, payload: Record<string, unknown>): void {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function listCandidateJobIds(limit: number): Promise<string[]> {
  const rows = await query<QueueCandidateRow>(
    `SELECT id
     FROM jobs
     WHERE status = 'queued'
        OR (status = 'processing' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  return rows.map((row) => row.id);
}

async function countRunnableJobs(): Promise<number> {
  const rows = await query<QueueCountRow>(
    `SELECT COUNT(*)::text AS count
     FROM jobs
     WHERE status = 'queued'
        OR (status = 'processing' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))`
  );

  return Number(rows[0]?.count ?? 0);
}

export async function runQueuedJobs(args?: {
  maxJobs?: number;
  source?: string;
  runId?: string;
}): Promise<JobRunnerSummary> {
  const maxJobs = clamp(args?.maxJobs ?? 1, 1, 10);
  const source = args?.source ?? "manual";
  const runId = args?.runId;
  const repos = getRepos();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const backlogBefore = await countRunnableJobs();

  const summary: JobRunnerSummary = {
    source,
    runId,
    maxJobs,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    backlog: {
      before: backlogBefore,
      after: backlogBefore
    },
    scanned: 0,
    claimed: 0,
    processed: 0,
    failed: 0,
    skipped: {
      notClaimable: 0,
      capped: 0,
      maxAttempts: 0
    }
  };

  const candidateIds = await listCandidateJobIds(maxJobs * 4);
  summary.scanned = candidateIds.length;
  logRunnerEvent("info", "runner.queue.scan", {
    runId,
    source,
    scanned: summary.scanned,
    maxJobs
  });

  for (const jobId of candidateIds) {
    if (summary.processed >= maxJobs) {
      break;
    }

    const job = await repos.jobs.getById(jobId);
    if (!job) {
      continue;
    }

    const leaseOwner = `${source}-${crypto.randomUUID().slice(0, 8)}`;
    const leaseResult = await tryClaimLease({
      jobId: job.id,
      ownerUserId: job.ownerUserId,
      leaseOwner
    });

    if (!leaseResult.claimed) {
      logRunnerEvent("warn", "runner.queue.claim_skipped", {
        runId,
        source,
        jobId: job.id,
        reason: leaseResult.reason
      });
      if (leaseResult.reason === "cap_global" || leaseResult.reason === "cap_per_org") {
        summary.skipped.capped += 1;
      } else if (leaseResult.reason === "max_attempts") {
        summary.skipped.maxAttempts += 1;
      } else {
        summary.skipped.notClaimable += 1;
      }
      continue;
    }

    summary.claimed += 1;
    logRunnerEvent("info", "runner.job.claimed", {
      runId,
      source,
      jobId: job.id,
      matterId: job.matterId
    });

    try {
      const matter = await repos.matters.getById(job.matterId);
      if (!matter) {
        logRunnerEvent("error", "runner.job.matter_missing", {
          runId,
          source,
          jobId: job.id,
          matterId: job.matterId
        });
        await failJobAndReleaseLease({
          jobId: job.id,
          errorMessage: "Matter not found for queued job.",
          errorCode: "MATTER_NOT_FOUND"
        });
        summary.failed += 1;
        summary.processed += 1;
        continue;
      }

      await processPrecedentJob({
        jobId: job.id,
        matterId: matter.id,
        orgId: matter.orgId,
        userId: job.ownerUserId,
        releaseLeaseOnFinish: true
      });

      const refreshed = await repos.jobs.getById(job.id);
      if (refreshed?.status === "failed") {
        logRunnerEvent("error", "runner.job.persisted_failed", {
          runId,
          source,
          jobId: job.id
        });
        summary.failed += 1;
      } else {
        logRunnerEvent("info", "runner.job.persisted_complete", {
          runId,
          source,
          jobId: job.id,
          status: refreshed?.status ?? "unknown"
        });
      }
    } catch (error) {
      logRunnerEvent("error", "runner.job.processing_error", {
        runId,
        source,
        jobId: job.id,
        step: "processing",
        error: error instanceof Error ? error.message : "unknown_error"
      });
      await failJobAndReleaseLease({
        jobId: job.id,
        errorMessage: error instanceof Error ? error.message : "Queued job processing failed.",
        errorCode: "RUNNER_PROCESS_ERROR"
      });
      summary.failed += 1;
    }

    summary.processed += 1;
  }

  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Math.max(0, Date.now() - startedAtMs);
  summary.backlog.after = await countRunnableJobs();

  return summary;
}
