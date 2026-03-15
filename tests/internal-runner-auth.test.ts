import assert from "node:assert/strict";
import test from "node:test";
import { validateInternalRunnerAuth } from "../lib/server/internalRunnerAuth.ts";

test("runner auth accepts bearer cron secret", () => {
  const request = new Request("http://localhost/api/internal/jobs/run-next", {
    headers: { authorization: "Bearer cron-secret" }
  });

  const result = validateInternalRunnerAuth(request, {
    env: {
      NODE_ENV: "production",
      CRON_SECRET: "cron-secret"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.method, "cron");
  }
});

test("runner auth accepts internal header secret", () => {
  const request = new Request("http://localhost/api/internal/jobs/run-next", {
    headers: { "x-internal-jobs-secret": "internal-secret" }
  });

  const result = validateInternalRunnerAuth(request, {
    env: {
      NODE_ENV: "production",
      INTERNAL_JOBS_SECRET: "internal-secret"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.method, "internal-header");
  }
});

test("runner auth returns clear production misconfiguration when secrets are missing", () => {
  const request = new Request("http://localhost/api/internal/jobs/run-next");
  const result = validateInternalRunnerAuth(request, {
    env: {
      NODE_ENV: "production"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 500);
    assert.equal(result.code, "missing_runner_secret");
  }
});

test("runner auth rejects invalid credentials when secrets are configured", () => {
  const request = new Request("http://localhost/api/internal/jobs/run-next", {
    headers: { authorization: "Bearer wrong" }
  });
  const result = validateInternalRunnerAuth(request, {
    env: {
      NODE_ENV: "production",
      CRON_SECRET: "expected"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
    assert.equal(result.code, "invalid_runner_credentials");
  }
});
