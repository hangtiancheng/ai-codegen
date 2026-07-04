import { describe, expect, it } from "vitest";
import { z } from "zod";
import { baseResponseSchema, businessErrorResponseSchema, isSuccessCode } from "./base-response";

describe("baseResponseSchema", () => {
  const schema = baseResponseSchema(z.object({ id: z.number() }));

  it("parses a valid envelope", () => {
    const value = schema.parse({
      code: 0,
      data: { id: 1 },
      message: "ok",
    });
    expect(value.code).toBe(0);
    expect(value.data.id).toBe(1);
  });

  it("rejects missing data", () => {
    const result = schema.safeParse({ code: 0 });
    expect(result.success).toBe(false);
  });

  it("treats message as optional", () => {
    const value = schema.parse({ code: 0, data: { id: 7 } });
    expect(value.message).toBeUndefined();
  });
});

describe("businessErrorResponseSchema", () => {
  it("requires a non-empty message", () => {
    const result = businessErrorResponseSchema.safeParse({
      code: 50001,
      message: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("isSuccessCode", () => {
  it("only accepts code 0 as success", () => {
    expect(isSuccessCode(0)).toBe(true);
    expect(isSuccessCode(40001)).toBe(false);
  });
});
