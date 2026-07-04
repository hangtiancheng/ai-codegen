import { Redis } from "ioredis";
import { buildAiModelRegistryConfigFromEnv, createAiModelRegistry } from "./ai/index.js";
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
import { createDefaultScreenshotCapturer } from "./app-screenshot.js";
import { createDefaultShutdown } from "./app-shutdown.js";
import { createConfiguredStorage } from "./app-storage.js";
import { createChatHistoryRepository, createChatHistoryService } from "./chat-history/index.js";
import { env } from "./config/index.js";
import { createPrismaClient } from "./database/index.js";
import {
  createBullMqScreenshotQueue,
  createBullMqScreenshotWorker,
  createDeploymentService,
  createQueuedScreenshotJob,
  createScreenshotJob,
  createScreenshotQueueFailureObserver,
  createScreenshotQueueProcessor,
  createStorageHealthCheck,
} from "./deployment/index.js";
import { createHealthService, createMetricsService } from "./observability/index.js";
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  createRedisRateLimitStore,
} from "./rate-limit/index.js";
import { createInMemorySessionStore, createRedisSessionStore } from "./session/index.js";
import { createUserRepository, createUserService } from "./user/index.js";
import {
  createCodegenWorkflow,
  createFileViteCodegenLogger,
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
  ...(env.HEALTH_MODEL_PROBE_ENABLED
    ? [createModelProviderHealthCheck(aiRegistry, env.HEALTH_MODEL_TIMEOUT_MS)]
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
  const aiRegistry = createAiModelRegistry(buildAiModelRegistryConfigFromEnv(env));
  const viteProjectLogger = createFileViteCodegenLogger(`${process.cwd()}/logs`);
  const { healthProbe: storageHealthProbe, storage } = createConfiguredStorage();
  const directScreenshotJob = createScreenshotJob(
    createDefaultScreenshotCapturer(),
    storage,
    appRepository,
    metricsService,
  );
  const screenshotQueue =
    redisClient === undefined ? undefined : createBullMqScreenshotQueue(redisClient);
  const screenshotJob =
    screenshotQueue === undefined
      ? directScreenshotJob
      : createQueuedScreenshotJob(screenshotQueue);
  const screenshotWorker =
    redisClient === undefined
      ? undefined
      : createBullMqScreenshotWorker(
          redisClient,
          createScreenshotQueueProcessor(directScreenshotJob),
        );
  const screenshotQueueEvents =
    redisClient === undefined
      ? undefined
      : createScreenshotQueueFailureObserver(redisClient, metricsService);
  const deploymentService = createDeploymentService(
    { deployHost: env.CODEGEN_DEPLOY_HOST },
    screenshotJob,
    undefined,
    viteProjectLogger,
  );
  const rateLimitStore =
    redisClient === undefined
      ? createInMemoryRateLimitStore()
      : createRedisRateLimitStore(redisClient);

  return {
    aiGenerationRateLimiter: createRateLimiter(rateLimitStore, {
      maxRequests: env.RATE_LIMIT_AI_GENERATION_MAX,
      namespace: "ai-generation",
      windowSeconds: env.RATE_LIMIT_AI_GENERATION_WINDOW_SECONDS,
    }),
    appService: createAppService(appRepository, createDefaultCodegenRouter(), deploymentService),
    chatHistoryService,
    codegenWorkflow: createCodegenWorkflow({
      chatWriter: createWorkflowChatWriter(chatHistoryService),
      codeGenerator: createLangChainCodeGenerator(aiRegistry),
      qualityChecker: createLangChainQualityChecker(aiRegistry),
      viteCodegenLogger: viteProjectLogger,
    }),
    deploymentService,
    db,
    healthService: createHealthService(
      createDefaultHealthChecks(db, aiRegistry, redisClient, storageHealthProbe),
    ),
    metricsService,
    sessionStore:
      redisClient === undefined
        ? createInMemorySessionStore()
        : createRedisSessionStore(redisClient),
    shutdown: createDefaultShutdown({
      database: db,
      ...(redisClient !== undefined && { redisClient }),
      ...(screenshotQueue !== undefined && { screenshotQueue }),
      ...(screenshotQueueEvents !== undefined && { screenshotQueueEvents }),
      ...(screenshotWorker !== undefined && { screenshotWorker }),
    }),
    staticDeployRootDir: `${process.cwd()}/tmp/code_deploy`,
    userService: createUserService(createUserRepository(db)),
  };
};
