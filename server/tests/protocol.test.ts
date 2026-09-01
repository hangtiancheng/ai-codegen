import { describe, expect, it } from "vitest";
import { agentClientMessageSchema } from "../src/agent-runtime/protocol.js";

// The client->server message union is `.strict()`, so unknown keys are rejected.

describe("agentClientMessageSchema - hello", () => {
  it("accepts a minimal hello", () => {
    expect(agentClientMessageSchema.safeParse({ type: "hello" }).success).toBe(true);
  });

  it("accepts a hello with optional requestId and numeric-string afterSequence", () => {
    expect(
      agentClientMessageSchema.safeParse({
        type: "hello",
        requestId: "req-1",
        afterSequence: "1024",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-numeric afterSequence", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "hello", afterSequence: "12a" }).success,
    ).toBe(false);
  });

  it("rejects unknown/extra fields (strict)", () => {
    expect(agentClientMessageSchema.safeParse({ type: "hello", unexpected: true }).success).toBe(
      false,
    );
  });
});

describe("agentClientMessageSchema - run", () => {
  it("accepts a valid run", () => {
    const result = agentClientMessageSchema.safeParse({
      type: "run",
      requestId: "req-2",
      input: "build me a todo app",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a run with the optional structured fields", () => {
    expect(
      agentClientMessageSchema.safeParse({
        type: "run",
        requestId: "req-3",
        input: "fix it",
        selectedElement: { tag: "div", id: "root" },
        previewError: "ReferenceError: x is not defined",
        clientFileRevision: "rev-9",
      }).success,
    ).toBe(true);
  });

  it("rejects a run missing requestId and input", () => {
    expect(agentClientMessageSchema.safeParse({ type: "run" }).success).toBe(false);
  });

  it("rejects an empty input", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "run", requestId: "r", input: "" }).success,
    ).toBe(false);
  });

  it("rejects an empty requestId", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "run", requestId: "", input: "hi" }).success,
    ).toBe(false);
  });

  it("rejects unknown/extra fields (strict)", () => {
    expect(
      agentClientMessageSchema.safeParse({
        type: "run",
        requestId: "r",
        input: "hi",
        rogue: 1,
      }).success,
    ).toBe(false);
  });
});

describe("agentClientMessageSchema - malformed", () => {
  it("rejects an unknown message type", () => {
    expect(agentClientMessageSchema.safeParse({ type: "definitely-not-a-type" }).success).toBe(
      false,
    );
  });

  it("rejects a message without a type", () => {
    expect(agentClientMessageSchema.safeParse({ requestId: "r" }).success).toBe(false);
  });

  it("validates a well-formed heartbeat but rejects a negative timestamp", () => {
    expect(agentClientMessageSchema.safeParse({ type: "heartbeat", timestamp: 100 }).success).toBe(
      true,
    );
    expect(agentClientMessageSchema.safeParse({ type: "heartbeat", timestamp: -1 }).success).toBe(
      false,
    );
  });
});
