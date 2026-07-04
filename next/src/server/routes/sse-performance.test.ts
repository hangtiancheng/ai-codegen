import { describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { buildApp } from "../test-support/index";
import {
  buildHarness,
  buildRegularUser,
  createStaticWorkflow,
  loginAndGetCookie,
} from "./user-routes-utils";

describe("SSE performance sanity", () => {
  it("streams long generation sessions without truncating events", async () => {
    const chunks = Array.from({ length: 500 }, (_, index) => `chunk-${String(index)}`);
    const harness = buildHarness({ codegenWorkflow: createStaticWorkflow(chunks) });
    const user = buildRegularUser({ id: 1n, userAccount: "sse-user" });
    harness.db.user.findFirst.mockResolvedValueOnce(user);
    const cookie = await loginAndGetCookie(harness.app, "sse-user", "password123");
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VANILLA_HTML, id: 9n, userId: 1n }),
    );

    const response = await harness.app.request("/api/app/chat/codegen?appId=9&message=long", {
      headers: { Cookie: cookie },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body.match(/^event: chunk$/gmu)?.length).toBe(500);
    expect(body.length).toBeLessThan(60_000);
    expect(body).toContain("event: done");
  });
});
