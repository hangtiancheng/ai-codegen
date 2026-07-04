import { describe, expect, it } from "vitest";
import { ErrorCode, hashPassword } from "../common/index.js";
import { ChatMessageType } from "../generated/prisma/enums.js";
import { buildApp, buildChatHistory, buildUser } from "../test-support/index.js";
import { buildHarness, jsonRequest, loginAndGetCookie, parseBody } from "./user-routes-utils.js";

describe("fixture-based parity flows", () => {
  it("preserves user, app, chat history, and deployment response shapes", async () => {
    const harness = buildHarness();
    const user = buildUser({
      id: 7n,
      userAccount: "parity-user",
      userPassword: hashPassword("password123"),
    });
    harness.db.user.findFirst.mockResolvedValueOnce(null);
    harness.db.user.create.mockResolvedValueOnce(user);

    const register = await jsonRequest(harness.app, "/api/user/register", {
      checkPassword: "password123",
      userAccount: "parity-user",
      userPassword: "password123",
    });

    harness.db.user.findFirst.mockResolvedValueOnce(user);
    const cookie = await loginAndGetCookie(harness.app, "parity-user", "password123");
    harness.db.app.findFirst.mockResolvedValueOnce(null);
    harness.db.app.create.mockResolvedValueOnce(buildApp({ id: 9n, userId: 7n }));
    const addApp = await jsonRequest(
      harness.app,
      "/api/app/add",
      { initPrompt: "build a vite dashboard" },
      cookie,
    );
    harness.db.chatHistory.findMany.mockResolvedValueOnce([
      buildChatHistory({
        appId: 9n,
        id: 1n,
        message: "hello",
        messageType: ChatMessageType.USER,
        userId: 7n,
      }),
    ]);
    const history = await harness.app.request("/api/chat-history/app/9?pageSize=20", {
      headers: { Cookie: cookie },
    });
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ deployKey: "abc123", id: 9n, userId: 7n }),
    );
    harness.db.app.update.mockResolvedValueOnce(buildApp({ id: 9n, userId: 7n }));
    const deploy = await jsonRequest(harness.app, "/api/app/deploy", { appId: "9" }, cookie);
    const deployBody = await parseBody(deploy);

    expect((await parseBody(register)).data).toBe("7");
    expect((await parseBody(addApp)).data).toBe("9");
    expect((await parseBody(history)).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ appId: "9", message: "hello" })]),
    );
    expect(deployBody.data).toBe("http://localhost:3000/api/dist/abc123/index.html");
    expect(deploy.status).toBe(200);
    expect(deployBody.code).toBe(ErrorCode.Success);
  });
});
