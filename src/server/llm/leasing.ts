/**
 * Job lease management for safe concurrent LLM processing.
 *
 * Enforces:
 *  - Per-org concurrency cap (LLM_MAX_CONCURRENCY_PER_ORG)
 *  - Global concurrency cap (LLM_MAX_CONCURRENCY_GLOBAL)
 *  - Max retry attempts (LLM_MAX_ATTEMPTS)
 *  - Lease expiry for stuck-job recovery
 */

import { getRepos } from "../repos/index.ts";

// ---------------------------------------------------------------------------
// Configuration (read from env, with safe defaults)
// ---------------------------------------------------------------------------

function getLeaseCfg() {
  return {
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
    maxConcurrencyPerOrg: Number(process.env.LLM_MAX_CONCURRENCY_PER_ORG ?? 3),
    maxConcurrencyGlobal: Number(process.env.LLM_MAX_CONCURRENCY_GLOBAL ?? 20),
    maxAttempts: Number(process.env.LLM_MAX_ATTEMPTS ?? 3)
  };
}

/** Lease duration = LLM timeout + 30s buffer */
function leaseDurationMs(): number {
  return getLeaseCfg().timeoutMs + 30_000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type LeaseResult =
  | { claimed: true; attempts: number }
  | { claimed: false; reason: "cap_per_org" | "cap_global" | "max_attempts" | "not_claimable"; retryAfterMs?: number };

/**
 * Attempt to atomically claim the processing lease for a job.
 *
 * Steps:
 *  1. Check global and per-owner concurrency caps.
 *  2. Attempt to atomically update the job: queued → processing with lease.
 *  3. If the job is already at max attempts, fail permanently.
 */
export async function tryClaimLease(input: {
  jobId: string;
  ownerUserId: string;
  leaseOwner: string;
}): Promise<LeaseResult> {
  const cfg = getLeaseCfg();
  const repos = getRepos();

  // ------------------------------------------------------------------
  // Concurrency cap checks (before touching the job row)
  // ------------------------------------------------------------------
  const [globalCount, orgCount] = await Promise.all([
    repos.jobs.countActiveLeasesGlobal(),
    repos.jobs.countActiveLeasesByOwner(input.ownerUserId)
  ]);

  if (globalCount >= cfg.maxConcurrencyGlobal) {
    return { claimed: false, reason: "cap_global", retryAfterMs: 5_000 };
  }

  if (orgCount >= cfg.maxConcurrencyPerOrg) {
    return { claimed: false, reason: "cap_per_org", retryAfterMs: 3_000 };
  }

  // ------------------------------------------------------------------
  // Atomic lease claim
  // ------------------------------------------------------------------
  const job = await repos.jobs.claimLease({
    jobId: input.jobId,
    leaseOwner: input.leaseOwner,
    leaseDurationMs: leaseDurationMs()
  });

  if (!job) {
    return { claimed: false, reason: "not_claimable" };
  }

  // ------------------------------------------------------------------
  // Max attempts guard (checked after claim so attempts is accurate)
  // ------------------------------------------------------------------
  if (job.attempts > cfg.maxAttempts) {
    // Mark permanently failed and release lease
    await repos.jobs.update(job.id, {
      status: "failed",
      errorMessage: `Exceeded maximum attempts (${cfg.maxAttempts}).`,
      lastErrorCode: "MAX_ATTEMPTS_EXCEEDED"
    });
    await repos.jobs.releaseLease(job.id);
    return { claimed: false, reason: "max_attempts" };
  }

  return { claimed: true, attempts: job.attempts };
}

/**
 * Release the lease and mark the job as failed with error details.
 * Safe to call even if the lease was never held.
 */
export async function failJobAndReleaseLease(input: {
  jobId: string;
  errorMessage: string;
  errorCode?: string;
}): Promise<void> {
  const repos = getRepos();
  await repos.jobs.update(input.jobId, {
    status: "failed",
    progress: 100,
    errorMessage: input.errorMessage,
    lastErrorCode: input.errorCode,
    lastErrorMessage: input.errorMessage
  });
  await repos.jobs.releaseLease(input.jobId);
}

/**
 * Release the lease without marking the job failed (for cap-exceeded returns).
 * Resets the job back to "queued" so it can be retried.
 */
export async function requeueAndReleaseLease(jobId: string): Promise<void> {
  const repos = getRepos();
  await repos.jobs.update(jobId, { status: "queued" });
  await repos.jobs.releaseLease(jobId);
}
