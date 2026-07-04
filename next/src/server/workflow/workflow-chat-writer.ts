import { ChatMessageType } from "@/generated/prisma/enums";
import type { ChatHistoryService } from "../chat-history/index";
import type { WorkflowChatWriter } from "./workflow-service";

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
