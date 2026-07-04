import { Hono } from "hono";
import type { AppService } from "./app-module/index";
import type { ChatHistoryService } from "./chat-history/index";
import { env } from "./config/index";
import type { PrismaDatabaseClient } from "./database/index";
import type { DeploymentService } from "./deployment/index";
import {
  createBodyLimitMiddleware,
  createCorsMiddleware,
  handleError,
  handleNotFound,
} from "./middleware/index";
import type { HealthService, MetricsService, RequestLogger } from "./observability/index";
import { createRequestContextMiddleware } from "./observability/index";
import type { RateLimiter } from "./rate-limit/index";
import {
  createAppRoutes,
  createChatHistoryRoutes,
  createManagementRoutes,
  createStaticRoutes,
  createUserRoutes,
  healthRoutes,
  workflowDemoRoutes,
} from "./routes/index";
import { type AppHonoEnv, type SessionStore, sessionMiddleware } from "./session/index";
import type { UserService } from "./user/index";
import type { CodegenWorkflow } from "./workflow/index";

export type AppDependencies = Readonly<{
  aiGenerationRateLimiter: RateLimiter;
  appService: AppService;
  chatHistoryService: ChatHistoryService;
  codegenWorkflow: CodegenWorkflow;
  deploymentService: DeploymentService;
  db: PrismaDatabaseClient;
  healthService: HealthService;
  metricsService: MetricsService;
  projectRootDir?: string;
  requestLogger?: RequestLogger;
  sessionStore: SessionStore;
  shutdown?: () => Promise<void>;
  staticDeployRootDir?: string;
  staticOutputRootDir?: string;
  userService: UserService;
}>;

export { createDefaultDependencies } from "./app-dependencies";

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
      deployRootDir: deps.staticDeployRootDir ?? `${process.cwd()}/tmp/code_deploy`,
      outputRootDir: deps.staticOutputRootDir ?? `${process.cwd()}/tmp/code_output`,
    }),
  );
  app.route(`/${env.API_PREFIX}`, api);

  return app;
};

export type AppType = ReturnType<typeof createApp>;
