import type { ChatHistoryService } from "../chat-history/index.js";
import { ChatMessageType } from "../generated/prisma/enums.js";
import type { WorkflowChatWriter } from "./workflow-service.js";

export const createWorkflowChatWriter = (
  chatHistoryService: ChatHistoryService,
): WorkflowChatWriter => ({
  writeAiMessage: async (input) => {
    await chatHistoryService.addMessage({
      appId: input.appId,
      message: input.message,
      messageType: ChatMessageType.AI,
      userId: input.userId,
    });
  },
  writeUserMessage: async (input) => {
    await chatHistoryService.addMessage({
      appId: input.appId,
      message: input.message,
      messageType: ChatMessageType.USER,
      userId: input.userId,
    });
  },
});
