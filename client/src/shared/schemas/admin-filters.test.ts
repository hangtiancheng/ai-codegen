import { describe, expect, it } from "vitest";
import {
  appQueryRequestSchema,
  chatHistoryQueryRequestSchema,
  userQueryRequestSchema,
} from "./admin-filters";

describe("userQueryRequestSchema", () => {
  it("applies pagination defaults", () => {
    const value = userQueryRequestSchema.parse({});
    expect(value.pageNum).toBe(1);
    expect(value.pageSize).toBe(10);
  });

  it("rejects unknown role", () => {
    const result = userQueryRequestSchema.safeParse({ userRole: "guest" });
    expect(result.success).toBe(false);
  });
});

describe("appQueryRequestSchema", () => {
  it("accepts optional fields", () => {
    const value = appQueryRequestSchema.parse({
      appName: "demo",
      codegenType: "VITE_PROJECT",
    });
    expect(value.codegenType).toBe("VITE_PROJECT");
  });

  it("rejects negative priority", () => {
    const result = appQueryRequestSchema.safeParse({ priority: -1 });
    expect(result.success).toBe(false);
  });
});

describe("chatHistoryQueryRequestSchema", () => {
  it("accepts cursor timestamp", () => {
    const value = chatHistoryQueryRequestSchema.parse({
      lastCreateTime: "2026-01-01T00:00:00Z",
      messageType: "user",
    });
    expect(value.lastCreateTime).toBe("2026-01-01T00:00:00Z");
    expect(value.messageType).toBe("user");
  });

  it("rejects empty cursor", () => {
    const result = chatHistoryQueryRequestSchema.safeParse({
      lastCreateTime: "",
    });
    expect(result.success).toBe(false);
  });
});
