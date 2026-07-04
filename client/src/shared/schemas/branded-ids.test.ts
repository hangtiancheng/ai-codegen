import { describe, expect, it } from "vitest";
import { appIdSchema, chatHistoryIdSchema, userIdSchema } from "./branded-ids";

describe("branded ID schemas", () => {
  it("normalizes supported positive integer ID inputs to strings", () => {
    expect(appIdSchema.parse(42)).toBe("42");
    expect(userIdSchema.parse("42")).toBe("42");
    expect(chatHistoryIdSchema.parse(42n)).toBe("42");
  });

  it("rejects invalid ID inputs", () => {
    expect(appIdSchema.safeParse("0").success).toBe(false);
    expect(userIdSchema.safeParse(1.2).success).toBe(false);
    expect(
      chatHistoryIdSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success,
    ).toBe(false);
  });
});
