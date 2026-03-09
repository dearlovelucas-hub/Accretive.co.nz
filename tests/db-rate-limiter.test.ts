import assert from "node:assert/strict";
import test from "node:test";
import { DbRequestRateLimiter } from "../src/server/db/rateLimiter.ts";

test("acquire does not block when rate limiting is disabled", async () => {
  let nowMs = 0;
  const limiter = new DbRequestRateLimiter(
    {
      maxRequests: 0,
      windowMs: 1000
    },
    {
      now: () => nowMs,
      sleep: async (ms: number) => {
        nowMs += ms;
      }
    }
  );

  await limiter.acquire();
  await limiter.acquire();

  assert.equal(nowMs, 0);
});

test("acquire throttles once bucket capacity is exceeded", async () => {
  let nowMs = 0;
  const limiter = new DbRequestRateLimiter(
    {
      maxRequests: 2,
      windowMs: 100
    },
    {
      now: () => nowMs,
      sleep: async (ms: number) => {
        nowMs += ms;
      }
    }
  );

  await limiter.acquire();
  await limiter.acquire();
  assert.equal(nowMs, 0);

  await limiter.acquire();
  assert.equal(nowMs, 50);

  await limiter.acquire();
  assert.equal(nowMs, 100);
});

test("constructor validates options", () => {
  assert.throws(
    () =>
      new DbRequestRateLimiter({
        maxRequests: -1,
        windowMs: 1000
      }),
    /non-negative integer/
  );

  assert.throws(
    () =>
      new DbRequestRateLimiter({
        maxRequests: 10,
        windowMs: 0
      }),
    /positive integer/
  );
});
