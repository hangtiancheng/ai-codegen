import { describe, expect, it } from "vitest";
import {
  chatStreamBusinessErrorPayloadSchema,
  chatStreamDonePayloadSchema,
  chatStreamMessagePayloadSchema,
} from "./chat-stream";

describe("chatStreamMessagePayloadSchema", () => {
  it("requires the d field", () => {
    const value = chatStreamMessagePayloadSchema.parse({ d: "chunk" });
    expect(value.d).toBe("chunk");
  });

  it("rejects non-string d", () => {
    const result = chatStreamMessagePayloadSchema.safeParse({ d: 123 });
    expect(result.success).toBe(false);
  });
});

describe("chatStreamBusinessErrorPayloadSchema", () => {
  it("requires a non-empty message", () => {
    const result = chatStreamBusinessErrorPayloadSchema.safeParse({
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional code", () => {
    const value = chatStreamBusinessErrorPayloadSchema.parse({
      message: "rate limited",
    });
    expect(value.code).toBeUndefined();
  });
});

describe("chatStreamDonePayloadSchema", () => {
  it("treats undefined as valid", () => {
    const value = chatStreamDonePayloadSchema.parse(undefined);
    expect(value).toBeUndefined();
  });

  it("accepts optional reason", () => {
    const value = chatStreamDonePayloadSchema.parse({ reason: "stop" });
    expect(value?.reason).toBe("stop");
  });
});
