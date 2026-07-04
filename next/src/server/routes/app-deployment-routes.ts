import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import {
  type AppDeployRequest,
  type AppDownloadParam,
  type AppService,
  appDeploySchema,
  appDownloadParamSchema,
} from "../app-module/index";
import { createSuccessResponse, ErrorCode, HttpError } from "../common/index";
import { type AppHonoEnv, requireLogin } from "../session/index";
import type { SessionUser } from "../session/session.schema";
import { createAppProjectArchive } from "./app-download";

export type AppDeploymentRoutesDeps = Readonly<{
  appService: AppService;
  projectRootDir?: string;
}>;

const requireUserId = (user: SessionUser | undefined): bigint => {
  if (user === undefined) {
    throw new HttpError(ErrorCode.NotLoginError, "User not logged in", 401);
  }
  return BigInt(user.id);
};

export const createAppDeploymentRoutes = ({
  appService,
  projectRootDir,
}: AppDeploymentRoutesDeps) =>
  new Hono<AppHonoEnv>()
    .post("/deploy", requireLogin, zValidator("json", appDeploySchema), async (c) => {
      const userId = requireUserId(c.get("user"));
      const body: AppDeployRequest = c.req.valid("json");
      const url = await appService.deployApp(body.appId, userId);
      return c.json(createSuccessResponse(url));
    })
    .get(
      "/download/:appId",
      requireLogin,
      zValidator("param", appDownloadParamSchema),
      async (c) => {
        const { appId }: AppDownloadParam = c.req.valid("param");
        const userId = requireUserId(c.get("user"));
        const { archive, filename } = await createAppProjectArchive(
          { appService, ...(projectRootDir !== undefined && { projectRootDir }) },
          { appId, userId },
        );
        c.header("Content-Type", "application/zip");
        c.header("Content-Disposition", `attachment; filename="${filename}"`);
        return stream(c, async (responseStream) => {
          for await (const chunk of archive) {
            await responseStream.write(chunk);
          }
        });
      },
    );

export type AppDeploymentRoutes = ReturnType<typeof createAppDeploymentRoutes>;
