import { describe, expect, it } from "vitest";
import { transformLegacySnapshot } from "./migration-transform.js";
import { validateMigrationSnapshot } from "./migration-validate.js";

const baseSnapshot = transformLegacySnapshot({
  apps: [
    {
      appCover: null,
      appName: "Demo",
      codegenType: "MULTI_FILES",
      createTime: "2026-01-01T00:00:00.000Z",
      deployKey: "demo",
      deployTime: null,
      editTime: "2026-01-01T00:00:00.000Z",
      id: "10",
      initPrompt: "Build a page",
      isDelete: 0,
      priority: 0,
      updateTime: "2026-01-01T00:00:00.000Z",
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
      messageType: "user",
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
      userRole: "user",
    },
  ],
});

const firstApp = () => {
  const app = baseSnapshot.apps.at(0);
  if (app === undefined) {
    throw new Error("Missing app fixture");
  }
  return app;
};

const firstUser = () => {
  const user = baseSnapshot.users.at(0);
  if (user === undefined) {
    throw new Error("Missing user fixture");
  }
  return user;
};

describe("migration validation", () => {
  it("accepts snapshots with valid references", () => {
    const report = validateMigrationSnapshot(baseSnapshot);

    expect(report.ok).toBe(true);
    expect(report.counts).toEqual({ apps: 1, chatHistories: 1, users: 1 });
  });

  it("reports duplicates and missing references", () => {
    const report = validateMigrationSnapshot({
      ...baseSnapshot,
      apps: [...baseSnapshot.apps, { ...firstApp(), deployKey: "demo", id: "11", userId: "999" }],
      users: [...baseSnapshot.users, { ...firstUser(), id: "2" }],
    });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain("Duplicate user account: alice");
    expect(report.errors).toContain("Duplicate deploy key: demo");
    expect(report.errors).toContain("Missing app owner user id: 999");
  });
});
