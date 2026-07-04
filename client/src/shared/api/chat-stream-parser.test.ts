import { describe, expect, it } from "vitest";
import { parseStreamEvent } from "./chat-stream-parser";

describe("parseStreamEvent", () => {
  it("returns message kind for default event with valid payload", () => {
    expect(
      parseStreamEvent({ event: "", data: JSON.stringify({ d: "hello" }) }),
    ).toEqual({ kind: "message", payload: { d: "hello" } });
  });

  it("returns done kind for done event", () => {
    expect(parseStreamEvent({ event: "done", data: "" })).toEqual({
      kind: "done",
    });
  });

  it("returns business-error kind with parsed payload", () => {
    expect(
      parseStreamEvent({
        event: "business-error",
        data: JSON.stringify({ code: 1234, message: "boom" }),
      }),
    ).toEqual({
      kind: "business-error",
      payload: { code: 1234, message: "boom" },
    });
  });

  it("falls back to default error payload when business-error data is malformed", () => {
    expect(
      parseStreamEvent({ event: "business-error", data: "<<<>>>" }),
    ).toEqual({
      kind: "business-error",
      payload: { message: "Stream error" },
    });
  });

  it("returns ignored for malformed message payload", () => {
    expect(parseStreamEvent({ event: "", data: "not-json" })).toEqual({
      kind: "ignored",
    });
  });

  it("returns ignored for unknown event names", () => {
    expect(parseStreamEvent({ event: "unknown", data: "{}" })).toEqual({
      kind: "ignored",
    });
  });
});
