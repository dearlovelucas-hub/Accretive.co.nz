import * as crypto from "node:crypto";
import { query } from "@/src/server/db";
import { getRepos } from "@/src/server/repos";
import { failJobAndReleaseLease, tryClaimLease } from "@/src/server/llm/leasing";
import { processDraftJobFromUploads } from "./draftProcessor";
import { processPrecedentJob } from "./precedentPipeline";

export type JobRunnerSummary = {
  source: string;
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
}): Promise<JobRunnerSummary> {
  const maxJobs = clamp(args?.maxJobs ?? 1, 1, 10);
  const source = args?.source ?? "manual";
  const repos = getRepos();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const backlogBefore = await countRunnableJobs();

  const summary: JobRunnerSummary = {
    source,
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

    try {
      if (job.matterId) {
        const matter = await repos.matters.getById(job.matterId);
        if (!matter) {
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
      } else {
        await processDraftJobFromUploads({
          jobId: job.id,
          releaseLeaseOnFinish: true
        });
      }

      const refreshed = await repos.jobs.getById(job.id);
      if (refreshed?.status === "failed") {
        summary.failed += 1;
      }
    } catch (error) {
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
