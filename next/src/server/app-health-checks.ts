import { HumanMessage } from "@langchain/core/messages";
import type { Redis } from "ioredis";
import type { AiModelRegistry } from "./ai/index";
import type { PrismaDatabaseClient } from "./database/index";
import type { HealthCheck } from "./observability/index";

export const createDatabaseHealthCheck = (db: PrismaDatabaseClient): HealthCheck => ({
  name: "database",
  probe: async () => {
    try {
      await db.$connect();
      return "up";
    } catch {
      return "down";
    }
  },
});

export const createRedisHealthCheck = (redisClient: Redis | undefined): HealthCheck => ({
  name: "redis",
  probe: async () => {
    if (redisClient === undefined) return "up";
    try {
      await redisClient.ping();
      return "up";
    } catch {
      return "down";
    }
  },
});

const withTimeout = async (operation: Promise<unknown>, timeoutMs: number): Promise<void> => {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Model provider health check timed out")),
      timeoutMs,
    );
  });
  try {
    await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
};

export const createModelProviderHealthCheck = (
  registry: AiModelRegistry,
  timeoutMs: number,
): HealthCheck => ({
  name: "modelProvider",
  probe: async () => {
    try {
      const model = registry.createModel("route");
      await withTimeout(model.invoke([new HumanMessage("Reply with ok.")]), timeoutMs);
      return "up";
    } catch {
      return "down";
    }
  },
});
