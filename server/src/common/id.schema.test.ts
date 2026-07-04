import { describe, expect, it } from "vitest";
import { idSchema } from "./id.schema.js";

describe("idSchema", () => {
  it("normalizes supported positive integer ID inputs to bigint", () => {
    expect(idSchema.parse("42")).toBe(42n);
    expect(idSchema.parse(42)).toBe(42n);
    expect(idSchema.parse(42n)).toBe(42n);
  });

  it("rejects invalid ID inputs", () => {
    expect(idSchema.safeParse("0").success).toBe(false);
    expect(idSchema.safeParse(1.2).success).toBe(false);
    expect(idSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
});
