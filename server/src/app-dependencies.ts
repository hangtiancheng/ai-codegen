import { Redis } from "ioredis";
import {
  buildAiModelRegistryConfigFromEnv,
  createAiModelRegistry,
} from "./ai/index.js";
import type { AppDependencies } from "./app.js";
import {
  createDatabaseHealthCheck,
  createModelProviderHealthCheck,
  createRedisHealthCheck,
} from "./app-health-checks.js";
import {
  type AppRepository,
  createAppRepository,
  createAppService,
  createDefaultCodegenRouter,
} from "./app-module/index.js";
import { createDefaultShutdown } from "./app-shutdown.js";
import { createConfiguredStorage } from "./app-storage.js";
import {
  createChatHistoryRepository,
  createChatHistoryService,
} from "./chat-history/index.js";
import { env } from "./config/index.js";
import { createPrismaClient } from "./database/index.js";
import { createStorageHealthCheck } from "./deployment/index.js";
import {
  createHealthService,
  createMetricsService,
} from "./observability/index.js";
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  createRedisRateLimitStore,
} from "./rate-limit/index.js";
import {
  createInMemorySessionStore,
  createRedisSessionStore,
} from "./session/index.js";
import { createUserRepository, createUserService } from "./user/index.js";
import {
  createCodegenWorkflow,
  createLangChainCodeGenerator,
  createLangChainQualityChecker,
  createWorkflowChatWriter,
} from "./workflow/index.js";

const createRedisClient = () =>
  env.REDIS_URL === undefined
    ? undefined
    : new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const createDefaultHealthChecks = (
  db: ReturnType<typeof createPrismaClient>,
  aiRegistry: ReturnType<typeof createAiModelRegistry>,
  redisClient: Redis | undefined,
  storageHealthProbe: ReturnType<typeof createConfiguredStorage>["healthProbe"],
) => [
  createDatabaseHealthCheck(db),
  ...(env.MODEL_PROVIDER_HEALTH_CHECK_ENABLED
    ? [
        createModelProviderHealthCheck(
          aiRegistry,
          env.MODEL_PROVIDER_HEALTH_CHECK_TIMEOUT_MS,
        ),
      ]
    : []),
  createRedisHealthCheck(redisClient),
  createStorageHealthCheck(storageHealthProbe),
];

export const createDefaultDependencies = (): AppDependencies => {
  const db = createPrismaClient();
  const redisClient = createRedisClient();
  const metricsService = createMetricsService();
  const appRepository: AppRepository = createAppRepository(db);
  const chatHistoryService = createChatHistoryService(
    createChatHistoryRepository(db),
  );
  const aiRegistry = createAiModelRegistry(
    buildAiModelRegistryConfigFromEnv(env),
  );
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
    appService: createAppService(appRepository, createDefaultCodegenRouter()),
    chatHistoryService,
    codegenWorkflow: createCodegenWorkflow({
      chatWriter: createWorkflowChatWriter(chatHistoryService),
      codeGenerator: createLangChainCodeGenerator(aiRegistry),
      qualityChecker: createLangChainQualityChecker(aiRegistry),
    }),
    db,
    healthService: createHealthService(
      createDefaultHealthChecks(
        db,
        aiRegistry,
        redisClient,
        storageHealthProbe,
      ),
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
