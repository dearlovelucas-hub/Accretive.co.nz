import { URL } from "node:url";

type AppEnv = {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  DATABASE_URL_TEST?: string;
  DB_RATE_LIMIT_MAX_REQUESTS: number;
  DB_RATE_LIMIT_WINDOW_MS: number;
};

export type ProductionEnvCheckScope = "startup" | "billing-webhook" | "internal-runner";

export type ProductionEnvIssue = {
  key: string;
  message: string;
};

let cachedEnv: AppEnv | null = null;

function isSet(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isPostgresProtocol(protocol: string): boolean {
  return protocol === "postgres:" || protocol === "postgresql:";
}

function requireString(name: "DATABASE_URL" | "SESSION_SECRET", value: string | undefined): string {
  const next = (value ?? "").trim();
  if (!next) {
    throw new Error(`${name} is required.`);
  }
  return next;
}

function validateDatabaseUrl(name: "DATABASE_URL" | "DATABASE_URL_TEST", value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!isPostgresProtocol(parsed.protocol)) {
    throw new Error(`${name} must use postgres:// or postgresql://.`);
  }

  if (!parsed.hostname) {
    throw new Error(`${name} must include a hostname.`);
  }

  return trimmed;
}

function parsePositiveInteger(name: string, value: string | undefined, fallbackValue: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(name: string, value: string | undefined, fallbackValue: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const DATABASE_URL = validateDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
  const DATABASE_URL_TEST = validateDatabaseUrl("DATABASE_URL_TEST", process.env.DATABASE_URL_TEST);
  const SESSION_SECRET = requireString("SESSION_SECRET", process.env.SESSION_SECRET);
  const DB_RATE_LIMIT_MAX_REQUESTS = parseNonNegativeInteger(
    "ACCRETIVE_DB_RATE_LIMIT_MAX_REQUESTS",
    process.env.ACCRETIVE_DB_RATE_LIMIT_MAX_REQUESTS,
    0
  );
  const DB_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    "ACCRETIVE_DB_RATE_LIMIT_WINDOW_MS",
    process.env.ACCRETIVE_DB_RATE_LIMIT_WINDOW_MS,
    86_400_000
  );

  if (SESSION_SECRET.length < 16) {
    throw new Error("SESSION_SECRET must be at least 16 characters long.");
  }

  if (!DATABASE_URL && process.env.NODE_ENV !== "test") {
    throw new Error("DATABASE_URL is required.");
  }

  if (process.env.NODE_ENV === "test" && !DATABASE_URL && !DATABASE_URL_TEST) {
    throw new Error("DATABASE_URL_TEST (or DATABASE_URL) is required when NODE_ENV=test.");
  }

  cachedEnv = {
    DATABASE_URL: DATABASE_URL ?? DATABASE_URL_TEST ?? "",
    DATABASE_URL_TEST,
    SESSION_SECRET,
    DB_RATE_LIMIT_MAX_REQUESTS,
    DB_RATE_LIMIT_WINDOW_MS
  };

  return cachedEnv;
}

export function getDatabaseUrl(): string {
  const env = getEnv();
  if (process.env.NODE_ENV === "test") {
    return env.DATABASE_URL_TEST ?? env.DATABASE_URL;
  }
  return env.DATABASE_URL;
}

export function resetEnvForTests(): void {
  cachedEnv = null;
}

export function getCriticalProductionEnvIssues(
  scope: ProductionEnvCheckScope = "startup",
  env: NodeJS.ProcessEnv = process.env
): ProductionEnvIssue[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: ProductionEnvIssue[] = [];
  const checkBilling = scope === "startup" || scope === "billing-webhook";
  const checkRunner = scope === "startup" || scope === "internal-runner";

  if (checkBilling && !isSet(env.BILLING_WEBHOOK_SECRET)) {
    issues.push({
      key: "BILLING_WEBHOOK_SECRET",
      message: "BILLING_WEBHOOK_SECRET is required in production."
    });
  }

  if (checkRunner && !isSet(env.CRON_SECRET) && !isSet(env.INTERNAL_JOBS_SECRET)) {
    issues.push({
      key: "CRON_SECRET|INTERNAL_JOBS_SECRET",
      message: "Either CRON_SECRET or INTERNAL_JOBS_SECRET is required in production."
    });
  }

  return issues;
}
