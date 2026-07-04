import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index";
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  createRedisRateLimitStore,
} from "./index";

describe("rate limiter", () => {
  it("enforces limits per identity", async () => {
    const limiter = createRateLimiter(createInMemoryRateLimitStore(), {
      maxRequests: 1,
      namespace: "ai-generation",
      windowSeconds: 60,
    });

    await expect(limiter.consume("user-1")).resolves.toBeUndefined();
    await expect(limiter.consume("user-2")).resolves.toBeUndefined();
    await expect(limiter.consume("user-1")).rejects.toMatchObject({
      code: ErrorCode.TooManyRequests,
      statusCode: 429,
    });
  });

  it("uses Redis increment and expiry for the first request in a window", async () => {
    const calls: string[] = [];
    const store = createRedisRateLimitStore({
      expire: async (key, seconds) => {
        calls.push(`${key}:${String(seconds)}`);
        return 1;
      },
      incr: async () => 1,
    });

    await expect(store.increment("key", 30)).resolves.toBe(1);
    expect(calls).toEqual(["key:30"]);
  });
});
