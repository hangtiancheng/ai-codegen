import { ConversationManager } from "@swifty.js/swifty";
import { ChatMessageType } from "../generated/prisma/enums.js";

const MAX_REPLAYED_MESSAGES = 20;

export type ReplayedMessage = Readonly<{
  message: string;
  messageType: ChatMessageType;
}>;

export const buildConversation = (
  history: readonly ReplayedMessage[],
  userPrompt: string,
): ConversationManager => {
  const conversation = new ConversationManager();
  for (const record of history.slice(-MAX_REPLAYED_MESSAGES)) {
    if (record.message.trim().length === 0) continue;
    if (record.messageType === ChatMessageType.AI) {
      conversation.addAssistantMessage(record.message);
      continue;
    }
    conversation.addUserMessage(record.message);
  }
  conversation.addUserMessage(userPrompt);
  return conversation;
};
