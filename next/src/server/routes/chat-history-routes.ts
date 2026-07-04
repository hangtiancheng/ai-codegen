import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  type ChatHistoryService,
  chatHistoryAppParamSchema,
  chatHistoryCursorQuerySchema,
  chatHistoryPageQuerySchema,
} from "../chat-history/index";
import { createSuccessResponse } from "../common/index";
import { type AppHonoEnv, requireAdmin, requireLogin } from "../session/index";

export type ChatHistoryRoutesDeps = Readonly<{ chatHistoryService: ChatHistoryService }>;

export const createChatHistoryRoutes = ({ chatHistoryService }: ChatHistoryRoutesDeps) =>
  new Hono<AppHonoEnv>()
    .get(
      "/app/:appId",
      requireLogin,
      zValidator("param", chatHistoryAppParamSchema),
      zValidator("query", chatHistoryCursorQuerySchema),
      async (c) => {
        const { appId } = c.req.valid("param");
        const result = await chatHistoryService.listByAppCursor(appId, c.req.valid("query"));
        return c.json(createSuccessResponse(result));
      },
    )
    .post(
      "/admin/list/page/vo",
      requireAdmin,
      zValidator("json", chatHistoryPageQuerySchema),
      async (c) => {
        const result = await chatHistoryService.adminListByPage(c.req.valid("json"));
        return c.json(createSuccessResponse(result));
      },
    );

export type ChatHistoryRoutes = ReturnType<typeof createChatHistoryRoutes>;
