import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import { buildHarness, jsonRequest, parseBody } from "./user-routes-utils.js";

describe("workflow demo routes", () => {
  it("preserves the synchronous workflow demo endpoint", async () => {
    const { app } = buildHarness();

    const response = await jsonRequest(app, "/api/workflow/execute", {
      prompt: "Build a landing page",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toEqual({
      codegenType: CodegenType.VANILLA_HTML,
      prompt: "Build a landing page",
      status: "demo",
    });
  });

  it("preserves the flux workflow demo SSE endpoint", async () => {
    const { app } = buildHarness();

    const response = await app.request("/api/workflow/execute-flux?prompt=hello");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(text).toContain("event: workflow-start");
    expect(text).toContain("event: chunk");
    expect(text).toContain("event: done");
  });

  it("preserves the sse workflow demo endpoint validation", async () => {
    const { app } = buildHarness();

    const response = await app.request("/api/workflow/execute-sse");

    expect(response.status).toBe(400);
  });
});
