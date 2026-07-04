import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { ChatMessageType } from "@/generated/prisma/enums";
import type { PrismaDatabaseClient } from "../database/index";
import { buildChatHistory } from "../test-support/index";
import { createChatHistoryRepository } from "./chat-history-repository";

describe("createChatHistoryRepository", () => {
  it("createMessage stores the inbound payload", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.chatHistory.create.mockResolvedValue(buildChatHistory());
    const repo = createChatHistoryRepository(db);

    await repo.createMessage({
      appId: 1n,
      message: "hi",
      messageType: ChatMessageType.USER,
      userId: 2n,
    });

    expect(db.chatHistory.create).toHaveBeenCalledWith({
      data: {
        appId: 1n,
        message: "hi",
        messageType: ChatMessageType.USER,
        userId: 2n,
      },
    });
  });

  it("listByAppCursor omits createTime filter when cursor is undefined", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.chatHistory.findMany.mockResolvedValue([]);
    const repo = createChatHistoryRepository(db);

    await repo.listByAppCursor(1n, undefined, 20);

    expect(db.chatHistory.findMany).toHaveBeenCalledWith({
      orderBy: { createTime: "desc" },
      take: 20,
      where: { appId: 1n, isDelete: false },
    });
  });

  it("listByAppCursor applies createTime lt filter when cursor is provided", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.chatHistory.findMany.mockResolvedValue([]);
    const repo = createChatHistoryRepository(db);
    const cursor = new Date("2025-01-01T00:00:00Z");

    await repo.listByAppCursor(1n, cursor, 10);

    expect(db.chatHistory.findMany).toHaveBeenCalledWith({
      orderBy: { createTime: "desc" },
      take: 10,
      where: { appId: 1n, createTime: { lt: cursor }, isDelete: false },
    });
  });
});
