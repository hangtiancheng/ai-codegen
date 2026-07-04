import { describe, expect, it } from "vitest";
import { createDefaultShutdown } from "./app-shutdown";

describe("default shutdown", () => {
  it("closes queue resources before Redis and database clients", async () => {
    const calls: string[] = [];
    const shutdown = createDefaultShutdown({
      database: {
        $disconnect: async () => {
          calls.push("database");
        },
      },
      redisClient: {
        quit: async () => {
          calls.push("redis");
        },
      },
      screenshotQueue: {
        close: async () => {
          calls.push("queue");
        },
      },
      screenshotQueueEvents: {
        close: async () => {
          calls.push("events");
        },
      },
      screenshotWorker: {
        close: async () => {
          calls.push("worker");
        },
      },
    });

    await shutdown();

    expect(calls).toEqual(["events", "worker", "queue", "redis", "database"]);
  });
});
