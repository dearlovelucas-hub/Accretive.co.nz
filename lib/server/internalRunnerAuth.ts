export type InternalRunnerAuthSuccess = {
  ok: true;
  method: "cron" | "internal-header" | "dev-open";
};

export type InternalRunnerAuthFailure = {
  ok: false;
  status: number;
  error: string;
  code: "missing_runner_secret" | "invalid_runner_credentials";
};

export type InternalRunnerAuthResult = InternalRunnerAuthSuccess | InternalRunnerAuthFailure;

type InternalRunnerAuthOptions = {
  allowInsecureWithoutSecret?: boolean;
  env?: NodeJS.ProcessEnv;
};

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateInternalRunnerAuth(
  request: Request,
  options: InternalRunnerAuthOptions = {}
): InternalRunnerAuthResult {
  const env = options.env ?? process.env;
  const allowInsecureWithoutSecret =
    options.allowInsecureWithoutSecret ?? env.NODE_ENV !== "production";
  const cronSecret = normalize(env.CRON_SECRET);
  const internalSecret = normalize(env.INTERNAL_JOBS_SECRET);
  const authHeader = request.headers.get("authorization");
  const internalHeader = request.headers.get("x-internal-jobs-secret");

  if (cronSecret || internalSecret) {
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { ok: true, method: "cron" };
    }
    if (internalSecret && internalHeader === internalSecret) {
      return { ok: true, method: "internal-header" };
    }
    return {
      ok: false,
      status: 401,
      code: "invalid_runner_credentials",
      error: "Invalid runner credentials."
    };
  }

  if (allowInsecureWithoutSecret) {
    return { ok: true, method: "dev-open" };
  }

  return {
    ok: false,
    status: 500,
    code: "missing_runner_secret",
    error: "Missing CRON_SECRET or INTERNAL_JOBS_SECRET in production."
  };
}
