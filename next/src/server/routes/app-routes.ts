import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  type AppAddRequest,
  type AppPageQuery,
  type AppService,
  type AppUpdateRequest,
  appAddSchema,
  appIdBodySchema,
  appIdQuerySchema,
  appPageQuerySchema,
  appUpdateSchema,
} from "../app-module/index";
import { createSuccessResponse, ErrorCode, HttpError } from "../common/index";
import type { MetricsService } from "../observability/index";
import type { RateLimiter } from "../rate-limit/index";
import { type AppHonoEnv, requireLogin } from "../session/index";
import type { SessionUser } from "../session/session.schema";
import type { CodegenWorkflow } from "../workflow/index";
import { createAppAdminRoutes } from "./app-admin-routes";
import { handleAppCodegen } from "./app-codegen";
import { createAppDeploymentRoutes } from "./app-deployment-routes";

export type AppRoutesDeps = Readonly<{
  aiGenerationRateLimiter: RateLimiter;
  appService: AppService;
  codegenWorkflow: CodegenWorkflow;
  metricsService: MetricsService;
  projectRootDir?: string;
}>;

const requireUserId = (user: SessionUser | undefined): bigint => {
  if (user === undefined) {
    throw new HttpError(ErrorCode.NotLoginError, "User not logged in", 401);
  }
  return BigInt(user.id);
};

export const createAppRoutes = ({
  aiGenerationRateLimiter,
  appService,
  codegenWorkflow,
  metricsService,
  projectRootDir,
}: AppRoutesDeps) =>
  new Hono<AppHonoEnv>()
    .get("/chat/codegen", requireLogin, async (c) =>
      handleAppCodegen(
        {
          aiGenerationRateLimiter,
          appService,
          codegenWorkflow,
          metricsService,
        },
        c.get("user"),
        c.req.query(),
      ),
    )
    .post("/add", requireLogin, zValidator("json", appAddSchema), async (c) => {
      const userId = requireUserId(c.get("user"));
      const body: AppAddRequest = c.req.valid("json");
      const id = await appService.addApp(body, userId);
      return c.json(createSuccessResponse(id));
    })
    .post("/update", requireLogin, zValidator("json", appUpdateSchema), async (c) => {
      const userId = requireUserId(c.get("user"));
      const body: AppUpdateRequest = c.req.valid("json");
      const ok = await appService.updateApp(body, userId);
      return c.json(createSuccessResponse(ok));
    })
    .post("/delete", requireLogin, zValidator("json", appIdBodySchema), async (c) => {
      const userId = requireUserId(c.get("user"));
      const { id } = c.req.valid("json");
      const ok = await appService.deleteApp(id, userId);
      return c.json(createSuccessResponse(ok));
    })
    .route(
      "/",
      createAppDeploymentRoutes({
        appService,
        ...(projectRootDir !== undefined && { projectRootDir }),
      }),
    )
    .get("/get/vo", zValidator("query", appIdQuerySchema), async (c) => {
      const { id } = c.req.valid("query");
      const vo = await appService.getAppVoById(id);
      return c.json(createSuccessResponse(vo));
    })
    .post("/my/list/page/vo", requireLogin, zValidator("json", appPageQuerySchema), async (c) => {
      const userId = requireUserId(c.get("user"));
      const query: AppPageQuery = c.req.valid("json");
      const result = await appService.myListAppVoByPage(query, userId);
      return c.json(createSuccessResponse(result));
    })
    .post("/awesome/list/page/vo", zValidator("json", appPageQuerySchema), async (c) => {
      const result = await appService.awesomeListAppVoByPage(c.req.valid("json"));
      return c.json(createSuccessResponse(result));
    })
    .route("/admin", createAppAdminRoutes({ appService }));

export type AppRoutes = ReturnType<typeof createAppRoutes>;
