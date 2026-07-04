import { describe, expect, it } from "vitest";
import {
  appChatRouteParamsSchema,
  appEditRouteParamsSchema,
} from "./route-params";

describe("appChatRouteParamsSchema", () => {
  it("parses numeric string into branded id", () => {
    const value = appChatRouteParamsSchema.parse({ id: "42" });
    expect(value.id).toBe("42");
  });

  it("rejects non-numeric value", () => {
    const result = appChatRouteParamsSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative", () => {
    const result = appChatRouteParamsSchema.safeParse({ id: "0" });
    expect(result.success).toBe(false);
  });
});

describe("appEditRouteParamsSchema", () => {
  it("rejects empty value", () => {
    const result = appEditRouteParamsSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });
});
