import { Redis } from "ioredis";
import type { AppDependencies } from "./app.js";
import {
  createDatabaseHealthCheck,
  createModelProviderHealthCheck,
  createRedisHealthCheck,
} from "./app-health-checks.js";
import { type AppRepository, createAppRepository, createAppService } from "./app-module/index.js";
import { createDefaultShutdown } from "./app-shutdown.js";
import { createConfiguredStorage } from "./app-storage.js";
import { createChatHistoryRepository, createChatHistoryService } from "./chat-history/index.js";
import {
  buildProviderConfig,
  createCodegenService,
  loadSystemPromptTemplate,
} from "./codegen-agent/index.js";
import { env } from "./config/index.js";
import { createPrismaClient } from "./database/index.js";
import { createStorageHealthCheck } from "./deployment/index.js";
import { createHealthService, createMetricsService } from "./observability/index.js";
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  createRedisRateLimitStore,
} from "./rate-limit/index.js";
import { createInMemorySessionStore, createRedisSessionStore } from "./session/index.js";
import { createUserRepository, createUserService } from "./user/index.js";

const createRedisClient = () =>
  env.REDIS_URL === undefined
    ? undefined
    : new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const createDefaultHealthChecks = (
  db: ReturnType<typeof createPrismaClient>,
  providerConfig: ReturnType<typeof buildProviderConfig>,
  redisClient: Redis | undefined,
  storageHealthProbe: ReturnType<typeof createConfiguredStorage>["healthProbe"],
) => [
  createDatabaseHealthCheck(db),
  ...(env.MODEL_PROVIDER_HEALTH_CHECK_ENABLED
    ? [createModelProviderHealthCheck(providerConfig, env.MODEL_PROVIDER_HEALTH_CHECK_TIMEOUT_MS)]
    : []),
  createRedisHealthCheck(redisClient),
  createStorageHealthCheck(storageHealthProbe),
];

export const createDefaultDependencies = (): AppDependencies => {
  const db = createPrismaClient();
  const redisClient = createRedisClient();
  const metricsService = createMetricsService();
  const appRepository: AppRepository = createAppRepository(db);
  const chatHistoryService = createChatHistoryService(createChatHistoryRepository(db));
  const providerConfig = buildProviderConfig(env);
  // Read at startup so a missing prompt file fails the boot instead of the
  // first generation request.
  const systemPromptTemplate = loadSystemPromptTemplate();
  const { healthProbe: storageHealthProbe } = createConfiguredStorage();
  const rateLimitStore =
    redisClient === undefined
      ? createInMemoryRateLimitStore()
      : createRedisRateLimitStore(redisClient);

  return {
    aiGenerationRateLimiter: createRateLimiter(rateLimitStore, {
      maxRequests: env.LLM_RATE_LIMIT,
      namespace: "ai-generation",
      windowSeconds: env.LLM_RATE_LIMIT_WINDOW_SECONDS,
    }),
    appService: createAppService(appRepository),
    chatHistoryService,
    codegenService: createCodegenService({
      chatHistoryService,
      maxIterations: env.AI_MAX_ITERATIONS,
      metricsService,
      providerConfig,
      systemPromptTemplate,
    }),
    db,
    healthService: createHealthService(
      createDefaultHealthChecks(db, providerConfig, redisClient, storageHealthProbe),
    ),
    metricsService,
    sessionStore:
      redisClient === undefined
        ? createInMemorySessionStore()
        : createRedisSessionStore(redisClient),
    shutdown: createDefaultShutdown({
      database: db,
      ...(redisClient !== undefined && { redisClient }),
    }),
    userService: createUserService(createUserRepository(db)),
  };
};
