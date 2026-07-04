import { describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { ErrorCode } from "../common/index";
import { createInMemoryRateLimitStore, createRateLimiter } from "../rate-limit/index";
import { buildApp } from "../test-support/index";
import {
  buildHarness,
  buildRegularUser,
  createStaticWorkflow,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils";

const userLogin = async () => {
  const harness = buildHarness({
    codegenWorkflow: createStaticWorkflow(["hello", " world"]),
  });
  const owner = buildRegularUser({ id: 1n, userAccount: "user1" });
  harness.db.user.findFirst.mockResolvedValueOnce(owner);
  const cookie = await loginAndGetCookie(harness.app, owner.userAccount, "password123");
  harness.db.user.findFirst.mockReset();
  return { ...harness, cookie, owner };
};

const parseSseEvents = (text: string): readonly string[] =>
  text
    .trim()
    .split("\n\n")
    .map((event) => event.split("\n")[0] ?? "");

describe("app routes - chat codegen SSE", () => {
  it("streams workflow events for the app owner", async () => {
    const { app, cookie, db } = await userLogin();
    db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VANILLA_HTML, id: 9n, userId: 1n }),
    );

    const response = await app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(parseSseEvents(text)).toEqual(["event: chunk", "event: chunk", "event: done"]);
  });

  it("preserves the legacy /chat/codegen SSE alias", async () => {
    const { app, cookie, db } = await userLogin();
    db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VANILLA_HTML, id: 9n, userId: 1n }),
    );

    const response = await app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(parseSseEvents(text)).toEqual(["event: chunk", "event: chunk", "event: done"]);
  });

  it("rate limits the legacy /chat/codegen alias", async () => {
    const harness = buildHarness({
      aiGenerationRateLimiter: createRateLimiter(createInMemoryRateLimitStore(), {
        maxRequests: 1,
        namespace: "ai-generation",
        windowSeconds: 60,
      }),
      codegenWorkflow: createStaticWorkflow(["ok"]),
    });
    const owner = buildRegularUser({ id: 1n, userAccount: "user1" });
    harness.db.user.findFirst.mockResolvedValueOnce(owner);
    const cookie = await loginAndGetCookie(harness.app, owner.userAccount, "password123");
    harness.db.user.findFirst.mockReset();
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VANILLA_HTML, id: 9n, userId: 1n }),
    );

    const first = await harness.app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const second = await harness.app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(body.code).toBe(ErrorCode.TooManyRequests);
  });

  it("rejects codegen when caller is not the app owner", async () => {
    const { app, cookie, db } = await userLogin();
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));

    const response = await app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("rate limits AI generation per user", async () => {
    const harness = buildHarness({
      aiGenerationRateLimiter: createRateLimiter(createInMemoryRateLimitStore(), {
        maxRequests: 1,
        namespace: "ai-generation",
        windowSeconds: 60,
      }),
      codegenWorkflow: createStaticWorkflow(["ok"]),
    });
    const owner = buildRegularUser({ id: 1n, userAccount: "user1" });
    harness.db.user.findFirst.mockResolvedValueOnce(owner);
    const cookie = await loginAndGetCookie(harness.app, owner.userAccount, "password123");
    harness.db.user.findFirst.mockReset();
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VANILLA_HTML, id: 9n, userId: 1n }),
    );

    const first = await harness.app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const second = await harness.app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(body.code).toBe(ErrorCode.TooManyRequests);
  });
});
