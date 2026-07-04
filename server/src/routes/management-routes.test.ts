import { describe, expect, it } from "vitest";
import { buildHarness } from "./user-routes-utils.js";

describe("management routes", () => {
  it("returns Prometheus-compatible metrics", async () => {
    const harness = buildHarness();
    harness.deps.metricsService.recordAiRequest({
      modelRole: "streaming",
      status: "success",
    });

    const response = await harness.app.request("/api/management/prometheus");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("ai_model_requests_total");
    expect(text).toContain('model_role="streaming"');
  });

  it("returns component health checks", async () => {
    const harness = buildHarness();
    const response = await harness.app.request("/api/management/health");
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      checks: {
        database: "up",
        modelProvider: "up",
        redis: "up",
        storage: "up",
      },
      status: "up",
    });
  });
});
