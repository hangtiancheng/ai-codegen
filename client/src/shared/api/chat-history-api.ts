import { z } from "zod";
import { getEndpointPaths } from "@/shared/config";
import { httpClient } from "./http-client-singleton";
import {
  chatHistorySchema,
  chatHistoryQueryRequestSchema,
  listAppChatHistoryParamsSchema,
  pageSchema,
  type AppId,
  type ChatHistoryQueryRequest,
  type ListAppChatHistoryParams,
} from "@/shared/schemas";

const pageChatHistorySchema = pageSchema(chatHistorySchema);

export type ChatHistoryPage = z.infer<typeof pageChatHistorySchema>;

function cursorChatHistorySchema(pageSize: number): z.ZodType<ChatHistoryPage> {
  return z.union([
    pageChatHistorySchema,
    z.array(chatHistorySchema).transform((records) => ({
      records,
      pageNumber: 1,
      pageSize,
      totalPage: records.length > 0 ? 1 : 0,
      totalRow: records.length,
    })),
  ]);
}

export async function listAppChatHistory(
  appId: AppId,
  params: Omit<ListAppChatHistoryParams, "appId">,
): Promise<ChatHistoryPage> {
  const validated = listAppChatHistoryParamsSchema.parse({ appId, ...params });
  const query: Record<string, string | number> = {
    pageSize: validated.pageSize,
  };
  if (validated.lastCreateTime !== undefined) {
    query.cursor = validated.lastCreateTime;
  }
  const endpoints = getEndpointPaths();
  return httpClient.request(
    { method: "GET", url: endpoints.appChatHistory(validated.appId), query },
    cursorChatHistorySchema(validated.pageSize),
  );
}

export async function listAdminChatHistoryPage(
  body: ChatHistoryQueryRequest,
): Promise<ChatHistoryPage> {
  return httpClient.request(
    {
      method: "POST",
      url: getEndpointPaths().adminChatHistoryList,
      body: chatHistoryQueryRequestSchema.parse(body),
    },
    pageChatHistorySchema,
  );
}
