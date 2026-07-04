import { type ChatHistory } from "@/shared/schemas";

export type ChatMessageRole = "user" | "ai";

export type ChatMessage = {
  readonly id: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly loading?: boolean;
  readonly createTime?: string;
};

export function chatHistoryToMessages(
  records: ReadonlyArray<ChatHistory>,
): ReadonlyArray<ChatMessage> {
  return records
    .map((record) => ({
      id: `history-${record.id}`,
      role: record.messageType,
      content: record.message,
      createTime: record.createTime,
    }))
    .reverse();
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    content,
  };
}

export function createLoadingAiMessage(): ChatMessage {
  return {
    id: `ai-${Date.now()}`,
    role: "ai",
    content: "",
    loading: true,
  };
}
