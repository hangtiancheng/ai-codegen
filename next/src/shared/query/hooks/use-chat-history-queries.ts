import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type ChatHistoryPage, listAdminChatHistoryPage, listAppChatHistory } from "@/shared/api";
import type { AppId, ChatHistoryQueryRequest } from "@/shared/schemas";
import { queryKeys } from "../query-keys";

export type AppChatHistoryParams = {
  readonly pageSize: number;
  readonly lastCreateTime?: string;
};

export function useAppChatHistoryPage(
  appId: AppId | undefined,
  params: AppChatHistoryParams,
): UseQueryResult<ChatHistoryPage> {
  return useQuery({
    queryKey: appId
      ? queryKeys.chatHistory.byAppPaged(appId, params)
      : ["chatHistory", "app", "disabled", params],
    queryFn: () => {
      if (!appId) {
        throw new Error("appId is required");
      }
      const { pageSize, lastCreateTime } = params;
      return listAppChatHistory(
        appId,
        lastCreateTime === undefined ? { pageSize } : { pageSize, lastCreateTime },
      );
    },
    enabled: appId !== undefined,
  });
}

export function useAdminChatHistoryPage(
  params: ChatHistoryQueryRequest,
  enabled = true,
): UseQueryResult<ChatHistoryPage> {
  return useQuery({
    queryKey: queryKeys.chatHistory.adminList(params),
    queryFn: () => listAdminChatHistoryPage(params),
    enabled,
  });
}
