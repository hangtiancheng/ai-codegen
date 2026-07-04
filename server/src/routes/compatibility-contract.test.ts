import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index.js";
import { buildHarness, jsonRequest, parseBody } from "./user-routes-utils.js";

const protectedRequests = [
  { method: "POST", path: "/api/app/add", body: { initPrompt: "build" } },
  { method: "POST", path: "/api/app/deploy", body: { appId: "9" } },
  { method: "GET", path: "/api/app/download/9" },
  { method: "GET", path: "/api/app/chat/codegen?appId=9&message=build" },
  { method: "GET", path: "/api/app/chat/codegen?appId=9&message=build" },
  { method: "GET", path: "/api/chat-history/app/9" },
  { method: "GET", path: "/api/user/get?id=9" },
] as const;

describe("preserved API route contracts", () => {
  it.each(protectedRequests)("keeps auth on $method $path", async (request) => {
    const { app } = buildHarness();
    const response =
      request.method === "POST"
        ? await jsonRequest(app, request.path, request.body)
        : await app.request(request.path);
    const body = await parseBody(response);

    expect(response.status).toBe(401);
    expect(body.code).toBe(ErrorCode.NotLoginError);
  });

  it("keeps public management and app read routes mounted", async () => {
    const { app, db } = buildHarness();
    db.app.findFirst.mockResolvedValueOnce(null);

    const health = await app.request("/api/health");
    const metrics = await app.request("/api/management/prometheus");
    const workflow = await jsonRequest(app, "/api/workflow/execute", {
      prompt: "demo",
    });
    const appDetail = await app.request("/api/app/get/vo?id=404");

    expect(health.status).toBe(200);
    expect(metrics.status).toBe(200);
    expect(metrics.headers.get("content-type")).toContain("text/plain");
    expect(workflow.status).toBe(200);
    expect(appDetail.status).toBe(404);
  });
});
