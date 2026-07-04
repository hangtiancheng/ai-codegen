import type { ChatMessageType } from "@/generated/prisma/enums";
import { toChatHistoryVo } from "./chat-history.mapper";
import type {
  ChatHistoryCursorQuery,
  ChatHistoryPageQuery,
  ChatHistoryVo,
} from "./chat-history.schema";
import type { ChatHistoryListFilter, ChatHistoryRepository } from "./chat-history-repository";
import { resolveChatHistorySortField } from "./chat-history-sorting";

const buildFilter = (query: ChatHistoryPageQuery): ChatHistoryListFilter => ({
  ...(query.appId !== undefined && { appId: query.appId }),
  ...(query.message !== undefined && { message: query.message }),
  ...(query.messageType !== undefined && { messageType: query.messageType }),
  ...(query.userId !== undefined && { userId: query.userId }),
});

export const createChatHistoryService = (chatHistoryRepository: ChatHistoryRepository) => {
  const addMessage = async (input: {
    appId: bigint;
    message: string;
    messageType: ChatMessageType;
    userId: bigint;
  }): Promise<void> => {
    await chatHistoryRepository.createMessage(input);
  };

  const listByAppCursor = async (
    appId: bigint,
    query: ChatHistoryCursorQuery,
  ): Promise<ChatHistoryVo[]> => {
    const cursorDate = query.cursor === undefined ? undefined : new Date(query.cursor);
    const records = await chatHistoryRepository.listByAppCursor(appId, cursorDate, query.pageSize);
    return [...records].reverse().map(toChatHistoryVo);
  };

  const adminListByPage = async (
    query: ChatHistoryPageQuery,
  ): Promise<{ records: ChatHistoryVo[]; total: number }> => {
    const filter = buildFilter(query);
    const [records, total] = await Promise.all([
      chatHistoryRepository.listActive({
        filter,
        skip: (query.current - 1) * query.pageSize,
        sort: {
          field: resolveChatHistorySortField(query.sortField),
          order: query.sortOrder === "ascend" ? "asc" : "desc",
        },
        take: query.pageSize,
      }),
      chatHistoryRepository.countActive(filter),
    ]);
    return { records: records.map(toChatHistoryVo), total };
  };

  return { addMessage, adminListByPage, listByAppCursor };
};

export type ChatHistoryService = ReturnType<typeof createChatHistoryService>;
