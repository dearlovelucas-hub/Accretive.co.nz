type Bucket = {
  failedCount: number;
  firstFailedAtMs: number;
  blockedUntilMs: number;
  lastSeenAtMs: number;
};

type LoginRateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
};

export type LoginRateLimitState = {
  limited: boolean;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function getConfig(env: NodeJS.ProcessEnv = process.env): LoginRateLimitConfig {
  return {
    maxAttempts: parsePositiveInt(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5),
    windowMs: parsePositiveInt(env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000)
  };
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function buildKey(username: string, ipAddress: string): string {
  return `${normalizeUsername(username)}|${ipAddress.trim() || "unknown"}`;
}

function clearExpired(nowMs: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.blockedUntilMs > nowMs) {
      continue;
    }
    if (nowMs - bucket.lastSeenAtMs > windowMs) {
      buckets.delete(key);
    }
  }
}

function getOrCreateBucket(key: string, nowMs: number): Bucket {
  const existing = buckets.get(key);
  if (existing) {
    existing.lastSeenAtMs = nowMs;
    return existing;
  }

  const created: Bucket = {
    failedCount: 0,
    firstFailedAtMs: nowMs,
    blockedUntilMs: 0,
    lastSeenAtMs: nowMs
  };
  buckets.set(key, created);
  return created;
}

export function getClientIpAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function getLoginRateLimitState(
  input: { username: string; ipAddress: string; nowMs?: number },
  env: NodeJS.ProcessEnv = process.env
): LoginRateLimitState {
  const config = getConfig(env);
  const nowMs = input.nowMs ?? Date.now();
  clearExpired(nowMs, config.windowMs);

  const key = buildKey(input.username, input.ipAddress);
  const bucket = buckets.get(key);

  if (!bucket || bucket.blockedUntilMs <= nowMs) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.blockedUntilMs - nowMs) / 1000));
  return { limited: true, retryAfterSeconds };
}

export function recordLoginFailure(
  input: { username: string; ipAddress: string; nowMs?: number },
  env: NodeJS.ProcessEnv = process.env
): LoginRateLimitState {
  const config = getConfig(env);
  const nowMs = input.nowMs ?? Date.now();
  clearExpired(nowMs, config.windowMs);

  const key = buildKey(input.username, input.ipAddress);
  const bucket = getOrCreateBucket(key, nowMs);

  if (bucket.blockedUntilMs > nowMs) {
    bucket.blockedUntilMs = nowMs + config.windowMs;
    bucket.lastSeenAtMs = nowMs;
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntilMs - nowMs) / 1000))
    };
  }

  if (nowMs - bucket.firstFailedAtMs >= config.windowMs) {
    bucket.firstFailedAtMs = nowMs;
    bucket.failedCount = 0;
  }

  bucket.failedCount += 1;
  bucket.lastSeenAtMs = nowMs;

  if (bucket.failedCount >= config.maxAttempts) {
    bucket.blockedUntilMs = nowMs + config.windowMs;
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(config.windowMs / 1000))
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export function clearLoginRateLimit(
  input: { username: string; ipAddress: string },
  env: NodeJS.ProcessEnv = process.env
): void {
  const config = getConfig(env);
  clearExpired(Date.now(), config.windowMs);
  buckets.delete(buildKey(input.username, input.ipAddress));
}

export function resetLoginRateLimitStateForTests(): void {
  buckets.clear();
}
