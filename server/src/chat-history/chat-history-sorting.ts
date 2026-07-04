import type { ChatHistoryModel } from "../generated/prisma/models/ChatHistory.js";

export type SortableChatHistoryField = keyof Pick<
  ChatHistoryModel,
  "createTime" | "updateTime" | "id"
>;

const SORTABLE_CHAT_HISTORY_FIELDS: Record<SortableChatHistoryField, true> = {
  createTime: true,
  id: true,
  updateTime: true,
};

const isSortableField = (field: string): field is SortableChatHistoryField =>
  Object.hasOwn(SORTABLE_CHAT_HISTORY_FIELDS, field);

export const resolveChatHistorySortField = (
  field: string | undefined,
): SortableChatHistoryField => {
  if (field !== undefined && isSortableField(field)) {
    return field;
  }
  return "createTime";
};
