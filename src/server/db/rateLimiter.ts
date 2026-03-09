import { setTimeout as sleep } from "node:timers/promises";

type TimeSource = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type DbRequestRateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
};

const defaultTimeSource: TimeSource = {
  now: () => Date.now(),
  sleep: async (ms: number) => {
    await sleep(ms);
  }
};

export class DbRequestRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly timeSource: TimeSource;

  private availableTokens: number;
  private lastRefillAt: number;

  constructor(options: DbRequestRateLimiterOptions, timeSource: TimeSource = defaultTimeSource) {
    if (!Number.isInteger(options.maxRequests) || options.maxRequests < 0) {
      throw new Error("DbRequestRateLimiter maxRequests must be a non-negative integer.");
    }

    if (!Number.isInteger(options.windowMs) || options.windowMs < 1) {
      throw new Error("DbRequestRateLimiter windowMs must be a positive integer.");
    }

    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.timeSource = timeSource;
    this.availableTokens = this.maxRequests;
    this.lastRefillAt = this.timeSource.now();
  }

  async acquire(): Promise<void> {
    if (this.maxRequests === 0) {
      return;
    }

    while (true) {
      const now = this.timeSource.now();
      this.refill(now);

      if (this.availableTokens >= 1) {
        this.availableTokens -= 1;
        return;
      }

      const tokensNeeded = 1 - this.availableTokens;
      const waitMs = Math.max(1, Math.ceil((tokensNeeded * this.windowMs) / this.maxRequests));
      await this.timeSource.sleep(waitMs);
    }
  }

  private refill(now: number): void {
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) {
      return;
    }

    const refillAmount = (elapsedMs * this.maxRequests) / this.windowMs;
    if (refillAmount <= 0) {
      return;
    }

    this.availableTokens = Math.min(this.maxRequests, this.availableTokens + refillAmount);
    this.lastRefillAt = now;
  }
}
