import type { DeepMockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";
import { type AppDependencies, createApp } from "../app.js";
import { createAppRepository, createAppService } from "../app-module/index.js";
import { createChatHistoryRepository, createChatHistoryService } from "../chat-history/index.js";
import type { PrismaDatabaseClient } from "../database/index.js";
import type { DeploymentService } from "../deployment/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import { createHealthService, createMetricsService } from "../observability/index.js";
import { createInMemoryRateLimitStore, createRateLimiter } from "../rate-limit/index.js";
import { createInMemorySessionStore } from "../session/index.js";
import { createUserRepository, createUserService } from "../user/index.js";
import {
  createCodegenWorkflow,
  createNoopQualityChecker,
  createStaticCodeGenerator,
  createWorkflowChatWriter,
} from "../workflow/index.js";

export type RouteTestHarness = Readonly<{
  app: ReturnType<typeof createApp>;
  db: DeepMockProxy<PrismaDatabaseClient>;
  deps: AppDependencies;
}>;

export const buildHarness = (
  overrides: Partial<
    Pick<
      AppDependencies,
      | "aiGenerationRateLimiter"
      | "codegenWorkflow"
      | "deploymentService"
      | "projectRootDir"
      | "staticOutputRootDir"
    >
  > = {},
): RouteTestHarness => {
  const db = mockDeep<PrismaDatabaseClient>();
  const chatHistoryService = createChatHistoryService(createChatHistoryRepository(db));
  const deploymentService: DeploymentService = overrides.deploymentService ?? {
    deployArtifacts: async (input) => ({
      deployDir: `/tmp/${input.deployKey}`,
      deployKey: input.deployKey,
      deployUrl: `http://localhost:3000/api/dist/${input.deployKey}/index.html`,
    }),
  };
  const deps: AppDependencies = {
    aiGenerationRateLimiter:
      overrides.aiGenerationRateLimiter ??
      createRateLimiter(createInMemoryRateLimitStore(), {
        maxRequests: 10,
        namespace: "ai-generation",
        windowSeconds: 60,
      }),
    appService: createAppService(
      createAppRepository(db),
      { routeCodegenType: async () => CodegenType.VITE_PROJECT },
      deploymentService,
    ),
    chatHistoryService,
    codegenWorkflow:
      overrides.codegenWorkflow ??
      createCodegenWorkflow({
        chatWriter: createWorkflowChatWriter(chatHistoryService),
        codeGenerator: createStaticCodeGenerator("<html>generated</html>"),
        qualityChecker: createNoopQualityChecker(),
      }),
    deploymentService,
    db,
    healthService: createHealthService(),
    metricsService: createMetricsService(),
    ...(overrides.projectRootDir !== undefined && {
      projectRootDir: overrides.projectRootDir,
    }),
    requestLogger: { info: () => undefined },
    sessionStore: createInMemorySessionStore(),
    ...(overrides.staticOutputRootDir !== undefined && {
      staticOutputRootDir: overrides.staticOutputRootDir,
    }),
    userService: createUserService(createUserRepository(db)),
  };
  return { app: createApp(deps), db, deps };
};
