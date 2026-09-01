import { Hono } from "hono";
import type { AppService } from "./app-module/index.js";
import type { ChatHistoryService } from "./chat-history/index.js";
import { env } from "./config/index.js";
import type { PrismaDatabaseClient } from "./database/index.js";
import {
  createBodyLimitMiddleware,
  createCorsMiddleware,
  handleError,
  handleNotFound,
} from "./middleware/index.js";
import type {
  HealthService,
  MetricsService,
  RequestLogger,
} from "./observability/index.js";
import { createRequestContextMiddleware } from "./observability/index.js";
import type { RateLimiter } from "./rate-limit/index.js";
import {
  createAppRoutes,
  createChatHistoryRoutes,
  createManagementRoutes,
  createStaticRoutes,
  createUserRoutes,
  healthRoutes,
  workflowDemoRoutes,
} from "./routes/index.js";
import {
  type AppHonoEnv,
  type SessionStore,
  sessionMiddleware,
} from "./session/index.js";
import type { UserService } from "./user/index.js";
import type { CodegenWorkflow } from "./workflow/index.js";

export type AppDependencies = Readonly<{
  aiGenerationRateLimiter: RateLimiter;
  appService: AppService;
  chatHistoryService: ChatHistoryService;
  codegenWorkflow: CodegenWorkflow;
  db: PrismaDatabaseClient;
  healthService: HealthService;
  metricsService: MetricsService;
  projectRootDir?: string;
  requestLogger?: RequestLogger;
  sessionStore: SessionStore;
  shutdown?: () => Promise<void>;
  staticOutputRootDir?: string;
  userService: UserService;
}>;

export { createDefaultDependencies } from "./app-dependencies.js";

export const createApp = (deps: AppDependencies) => {
  const app = new Hono<AppHonoEnv>();
  const api = new Hono<AppHonoEnv>();

  app.onError(handleError);
  app.notFound(handleNotFound);
  app.use("*", createCorsMiddleware());
  app.use("*", createBodyLimitMiddleware());
  app.use("*", createRequestContextMiddleware(deps.requestLogger));
  app.use("*", sessionMiddleware(deps.sessionStore));

  api.route("/", healthRoutes);
  api.route(
    "/user",
    createUserRoutes({
      sessionStore: deps.sessionStore,
      userService: deps.userService,
    }),
  );
  api.route(
    "/app",
    createAppRoutes({
      aiGenerationRateLimiter: deps.aiGenerationRateLimiter,
      appService: deps.appService,
      codegenWorkflow: deps.codegenWorkflow,
      metricsService: deps.metricsService,
      ...(deps.projectRootDir !== undefined && {
        projectRootDir: deps.projectRootDir,
      }),
    }),
  );
  api.route(
    "/management",
    createManagementRoutes({
      healthService: deps.healthService,
      metricsService: deps.metricsService,
    }),
  );
  api.route(
    "/chat-history",
    createChatHistoryRoutes({ chatHistoryService: deps.chatHistoryService }),
  );
  api.route("/workflow", workflowDemoRoutes);
  api.route(
    "/",
    createStaticRoutes({
      outputRootDir:
        deps.staticOutputRootDir ?? `${process.cwd()}/tmp/code_output`,
    }),
  );
  app.route(`/${env.BASE_URL}`, api);

  return app;
};

export type AppType = ReturnType<typeof createApp>;
