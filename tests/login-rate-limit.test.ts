import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLoginRateLimit,
  getLoginRateLimitState,
  recordLoginFailure,
  resetLoginRateLimitStateForTests
} from "../lib/server/loginRateLimit.ts";

const TEST_ENV = {
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: "3",
  LOGIN_RATE_LIMIT_WINDOW_MS: "1000"
} as unknown as NodeJS.ProcessEnv;

test.beforeEach(() => {
  resetLoginRateLimitStateForTests();
});

test("login limiter blocks after threshold and recovers after window", () => {
  const username = "Lucas";
  const ipAddress = "203.0.113.10";
  const now = 1_000_000;

  assert.deepEqual(getLoginRateLimitState({ username, ipAddress, nowMs: now }, TEST_ENV), {
    limited: false,
    retryAfterSeconds: 0
  });

  assert.equal(recordLoginFailure({ username, ipAddress, nowMs: now }, TEST_ENV).limited, false);
  assert.equal(recordLoginFailure({ username, ipAddress, nowMs: now + 100 }, TEST_ENV).limited, false);

  const lock = recordLoginFailure({ username, ipAddress, nowMs: now + 200 }, TEST_ENV);
  assert.equal(lock.limited, true);
  assert.ok(lock.retryAfterSeconds >= 1);

  const blocked = getLoginRateLimitState({ username, ipAddress, nowMs: now + 500 }, TEST_ENV);
  assert.equal(blocked.limited, true);

  const recovered = getLoginRateLimitState({ username, ipAddress, nowMs: now + 1_300 }, TEST_ENV);
  assert.equal(recovered.limited, false);
});

test("successful login clears lockout bucket for username + ip", () => {
  const username = "Lucas";
  const ipAddress = "203.0.113.11";
  const now = 2_000_000;

  recordLoginFailure({ username, ipAddress, nowMs: now }, TEST_ENV);
  recordLoginFailure({ username, ipAddress, nowMs: now + 100 }, TEST_ENV);
  recordLoginFailure({ username, ipAddress, nowMs: now + 200 }, TEST_ENV);

  assert.equal(getLoginRateLimitState({ username, ipAddress, nowMs: now + 300 }, TEST_ENV).limited, true);

  clearLoginRateLimit({ username, ipAddress }, TEST_ENV);

  assert.equal(getLoginRateLimitState({ username, ipAddress, nowMs: now + 300 }, TEST_ENV).limited, false);
});
