import { URL } from "node:url";

type AppEnv = {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  DATABASE_URL_TEST?: string;
};

let cachedEnv: AppEnv | null = null;

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

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const DATABASE_URL = validateDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
  const DATABASE_URL_TEST = validateDatabaseUrl("DATABASE_URL_TEST", process.env.DATABASE_URL_TEST);
  const SESSION_SECRET = requireString("SESSION_SECRET", process.env.SESSION_SECRET);

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
    SESSION_SECRET
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
