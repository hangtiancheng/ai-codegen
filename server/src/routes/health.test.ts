import { describe, expect, it } from "vitest";
import { createApp, createDefaultDependencies } from "../app.js";
import { healthSuccessResponseSchema } from "./health.js";

describe("health route", () => {
  it("returns a typed success response", async () => {
    const app = createApp({
      ...createDefaultDependencies(),
      requestLogger: { info: () => undefined },
    });
    const response = await app.request("/api/health");
    const rawBody: unknown = await response.json();
    const body = healthSuccessResponseSchema.parse(rawBody);

    expect(response.status).toBe(200);
    expect(body.data.service).toBe("server-v2");
    expect(body.data.status).toBe("ok");
  });
});
