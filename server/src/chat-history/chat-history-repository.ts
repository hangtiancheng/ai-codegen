import type { PrismaDatabaseClient } from "../database/index.js";
import type { ChatMessageType } from "../generated/prisma/enums.js";
import type { SortableChatHistoryField } from "./chat-history-sorting.js";

type CreateMessageInput = Readonly<{
  appId: bigint;
  message: string;
  messageType: ChatMessageType;
  userId: bigint;
}>;

export type ChatHistoryListFilter = Readonly<{
  appId?: bigint;
  message?: string;
  messageType?: ChatMessageType;
  userId?: bigint;
}>;

export type ListChatHistoryParams = Readonly<{
  filter: ChatHistoryListFilter;
  skip: number;
  sort: { field: SortableChatHistoryField; order: "asc" | "desc" };
  take: number;
}>;

const buildListWhere = (filter: ChatHistoryListFilter) => ({
  isDelete: false,
  ...(filter.appId !== undefined && { appId: filter.appId }),
  ...(filter.userId !== undefined && { userId: filter.userId }),
  ...(filter.messageType !== undefined && { messageType: filter.messageType }),
  ...(filter.message !== undefined && {
    message: { contains: filter.message },
  }),
});

export const createChatHistoryRepository = (db: PrismaDatabaseClient) => ({
  countActive: (filter: ChatHistoryListFilter) =>
    db.chatHistory.count({ where: buildListWhere(filter) }),

  createMessage: (data: CreateMessageInput) =>
    db.chatHistory.create({
      data: {
        appId: data.appId,
        message: data.message,
        messageType: data.messageType,
        userId: data.userId,
      },
    }),

  listActive: (params: ListChatHistoryParams) =>
    db.chatHistory.findMany({
      orderBy: { [params.sort.field]: params.sort.order },
      skip: params.skip,
      take: params.take,
      where: buildListWhere(params.filter),
    }),

  listByAppCursor: (appId: bigint, cursor: Date | undefined, pageSize: number) => {
    const where =
      cursor === undefined
        ? { appId, isDelete: false }
        : { appId, createTime: { lt: cursor }, isDelete: false };

    return db.chatHistory.findMany({
      orderBy: { createTime: "desc" },
      take: pageSize,
      where,
    });
  },
});

export type ChatHistoryRepository = ReturnType<typeof createChatHistoryRepository>;
