import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorCode } from "../common/index.js";
import { ChatMessageType } from "../generated/prisma/enums.js";
import { buildChatHistory } from "../test-support/index.js";
import {
  buildAdmin,
  buildHarness,
  buildRegularUser,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils.js";

const cursorListDataSchema = z.array(
  z.object({
    appId: z.string(),
    id: z.string(),
    message: z.string(),
    messageType: z.enum(ChatMessageType),
    userId: z.string(),
  }),
);

const adminPageDataSchema = z.object({
  records: z.array(z.object({ id: z.string(), message: z.string() })),
  total: z.number(),
});

const loginAs = async (kind: "admin" | "user") => {
  const harness = buildHarness();
  const user =
    kind === "admin"
      ? buildAdmin({ id: 1n, userAccount: "admin" })
      : buildRegularUser({ id: 1n, userAccount: "user1" });
  harness.db.user.findFirst.mockResolvedValueOnce(user);
  const cookie = await loginAndGetCookie(harness.app, user.userAccount, "password123");
  harness.db.user.findFirst.mockReset();
  return { ...harness, cookie };
};

describe("chat-history routes - cursor read", () => {
  it("rejects GET /app/:appId when caller is not authenticated", async () => {
    const { app } = buildHarness();
    const response = await app.request("/api/chat-history/app/9");
    const body = await parseBody(response);

    expect(response.status).toBe(401);
    expect(body.code).toBe(ErrorCode.NotLoginError);
  });

  it("rejects GET /app/:appId when appId is malformed", async () => {
    const { app, cookie } = await loginAs("user");
    const response = await app.request("/api/chat-history/app/not-a-number", {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(400);
  });

  it("returns cursor-paginated history in ascending order", async () => {
    const { app, cookie, db } = await loginAs("user");
    const older = buildChatHistory({
      appId: 9n,
      createTime: new Date("2024-01-01T00:00:00Z"),
      id: 1n,
      message: "older",
    });
    const newer = buildChatHistory({
      appId: 9n,
      createTime: new Date("2024-01-02T00:00:00Z"),
      id: 2n,
      message: "newer",
    });
    db.chatHistory.findMany.mockResolvedValueOnce([newer, older]);

    const response = await app.request("/api/chat-history/app/9?pageSize=10", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    const records = cursorListDataSchema.parse(body.data);
    expect(records.map((r) => r.message)).toEqual(["older", "newer"]);
    expect(db.chatHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createTime: "desc" },
        take: 10,
        where: { appId: 9n, isDelete: false },
      }),
    );
  });

  it("forwards the cursor as a createTime upper bound", async () => {
    const { app, cookie, db } = await loginAs("user");
    db.chatHistory.findMany.mockResolvedValueOnce([]);
    const cursor = "2024-06-01T00:00:00.000Z";

    const response = await app.request(
      `/api/chat-history/app/9?cursor=${encodeURIComponent(cursor)}&pageSize=5`,
      { headers: { Cookie: cookie } },
    );

    expect(response.status).toBe(200);
    expect(db.chatHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          appId: 9n,
          createTime: { lt: new Date(cursor) },
          isDelete: false,
        }),
      }),
    );
  });

  it("rejects cursor pageSize above the schema ceiling", async () => {
    const { app, cookie } = await loginAs("user");
    const response = await app.request("/api/chat-history/app/9?pageSize=999", {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(400);
  });
});

describe("chat-history routes - admin paging", () => {
  it("rejects /admin/list/page/vo for non-admin users", async () => {
    const { app, cookie } = await loginAs("user");
    const response = await jsonRequest(
      app,
      "/api/chat-history/admin/list/page/vo",
      { current: 1, pageSize: 10 },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("allows admins to page chat history with a message filter", async () => {
    const { app, cookie, db } = await loginAs("admin");
    db.chatHistory.findMany.mockResolvedValueOnce([
      buildChatHistory({ id: 5n, message: "hello world" }),
    ]);
    db.chatHistory.count.mockResolvedValueOnce(1);

    const response = await jsonRequest(
      app,
      "/api/chat-history/admin/list/page/vo",
      { current: 1, message: "hello", pageSize: 10 },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    const data = adminPageDataSchema.parse(body.data);
    expect(data.total).toBe(1);
    expect(data.records).toHaveLength(1);
    const expectedWhere = expect.objectContaining({
      isDelete: false,
      message: { contains: "hello" },
    });
    expect(db.chatHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10, where: expectedWhere }),
    );
    expect(db.chatHistory.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });
});
