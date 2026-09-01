import { type ChatHistory } from "@/shared/schemas";

export type ChatMessageRole = "user" | "ai";

export type ToolPartStatus = "running" | "ok" | "error";

export type MessagePart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "tool";
      readonly name: string;
      readonly status: ToolPartStatus;
      readonly id?: string;
      readonly detail?: string;
    };

export type ChatMessage = {
  readonly id: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly parts?: ReadonlyArray<MessagePart>;
  readonly loading?: boolean;
  readonly createTime?: string;
};

export function appendTextPart(
  parts: ReadonlyArray<MessagePart>,
  text: string,
): ReadonlyArray<MessagePart> {
  const last = parts.at(-1);
  if (last?.kind === "text") {
    return [...parts.slice(0, -1), { kind: "text", text: last.text + text }];
  }
  return [...parts, { kind: "text", text }];
}

export function applyToolPart(
  parts: ReadonlyArray<MessagePart>,
  tool: {
    readonly name: string;
    readonly phase: "start" | "result";
    readonly id?: string | undefined;
    readonly detail?: string | undefined;
    readonly isError?: boolean | undefined;
  },
): ReadonlyArray<MessagePart> {
  if (tool.phase === "start") {
    return [
      ...parts,
      {
        kind: "tool",
        name: tool.name,
        status: "running",
        ...(tool.id !== undefined && { id: tool.id }),
        ...(tool.detail !== undefined && { detail: tool.detail }),
      },
    ];
  }
  const target = findRunningToolIndex(parts, tool.name, tool.id);
  if (target < 0) return parts;
  const existing = parts[target];
  if (existing?.kind !== "tool") return parts;
  return parts.map((part, index) =>
    index === target
      ? {
          ...existing,
          status: tool.isError === true ? "error" : "ok",
          ...(tool.detail !== undefined && { detail: tool.detail }),
        }
      : part,
  );
}

// Read-only tools run concurrently, so start/result can interleave. Match on the
// tool id when present and fall back to the oldest running call with that name.
function findRunningToolIndex(
  parts: ReadonlyArray<MessagePart>,
  name: string,
  id: string | undefined,
): number {
  if (id !== undefined) {
    const byId = parts.findIndex(
      (part) => part.kind === "tool" && part.id === id,
    );
    if (byId >= 0) return byId;
  }
  return parts.findIndex(
    (part) =>
      part.kind === "tool" && part.name === name && part.status === "running",
  );
}

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
