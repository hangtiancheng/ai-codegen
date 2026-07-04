import type { ChatHistoryModel } from "../generated/prisma/models/ChatHistory.js";
import type { ChatHistoryVo } from "./chat-history.schema.js";

export const toChatHistoryVo = (entity: ChatHistoryModel): ChatHistoryVo => ({
  appId: entity.appId.toString(),
  createTime: entity.createTime,
  id: entity.id.toString(),
  message: entity.message,
  messageType: entity.messageType,
  userId: entity.userId.toString(),
});
