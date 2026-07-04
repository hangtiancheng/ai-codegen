import { describe, expect, it } from "vitest";
import { transformLegacySnapshot } from "./migration-transform";

const legacySnapshot = {
  apps: [
    {
      appCover: "http://cdn/a.png",
      appName: "Demo",
      codegenType: "VITE_PROJECT",
      createTime: "2026-01-01T00:00:00.000Z",
      deployKey: "demo",
      deployTime: "2026-01-02T00:00:00.000Z",
      editTime: "2026-01-01T00:00:00.000Z",
      id: "10",
      initPrompt: "Build a page",
      isDelete: 0,
      priority: 1,
      updateTime: "2026-01-03T00:00:00.000Z",
      userId: "1",
    },
  ],
  chatHistories: [
    {
      appId: "10",
      createTime: "2026-01-01T00:00:00.000Z",
      id: "100",
      isDelete: 0,
      message: "hello",
      messageType: "ai",
      updateTime: "2026-01-01T00:00:00.000Z",
      userId: "1",
    },
  ],
  users: [
    {
      createTime: "2026-01-01T00:00:00.000Z",
      editTime: "2026-01-01T00:00:00.000Z",
      id: "1",
      isDelete: 0,
      updateTime: "2026-01-01T00:00:00.000Z",
      userAccount: "alice",
      userAvatar: null,
      username: "Alice",
      userPassword: "hash",
      userProfile: null,
      userRole: "admin",
    },
  ],
};

describe("migration transform", () => {
  it("normalizes legacy enum values and preserves stable ids", () => {
    const snapshot = transformLegacySnapshot(legacySnapshot);

    expect(snapshot.users[0]?.userRole).toBe("ADMIN");
    expect(snapshot.apps[0]?.codegenType).toBe("VITE_PROJECT");
    expect(snapshot.chatHistories[0]?.messageType).toBe("AI");
    expect(snapshot.apps[0]?.id).toBe("10");
  });
});
