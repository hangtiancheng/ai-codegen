import { describe, expect, it } from "vitest";
import { chatHistorySchema, listAppChatHistoryParamsSchema } from "./chat-history";

describe("chatHistorySchema", () => {
  it("parses a valid record", () => {
    const value = chatHistorySchema.parse({
      id: 1,
      message: "hello",
      messageType: "USER",
      appId: 10,
      userId: 7,
      createTime: "2026-05-01T00:00:00Z",
    });
    expect(value.messageType).toBe("user");
  });

  it("rejects unknown message type", () => {
    const result = chatHistorySchema.safeParse({
      id: 1,
      message: "hi",
      messageType: "system",
      appId: 1,
      userId: 1,
      createTime: "2026-05-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("listAppChatHistoryParamsSchema", () => {
  it("applies pageSize default", () => {
    const value = listAppChatHistoryParamsSchema.parse({ appId: 1 });
    expect(value.pageSize).toBe(10);
  });

  it("rejects non-positive pageSize", () => {
    const result = listAppChatHistoryParamsSchema.safeParse({
      appId: 1,
      pageSize: 0,
    });
    expect(result.success).toBe(false);
  });
});
