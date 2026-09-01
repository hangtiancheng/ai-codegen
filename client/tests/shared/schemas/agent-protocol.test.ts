import { describe, expect, it } from "vitest";
import {
  agentClientMessageSchema,
  agentFileMutationResponseSchema,
  agentFilePathSchema,
  agentRuntimeStatusSchema,
  agentServerMessageSchema,
} from "@/shared/schemas/agent-protocol";

describe("agentFilePathSchema", () => {
  it("accepts clean relative POSIX paths", () => {
    for (const value of [
      "src/App.tsx",
      "package.json",
      "a/b/c/d.ts",
      "index.ts",
    ]) {
      expect(agentFilePathSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects parent-directory traversal", () => {
    expect(agentFilePathSchema.safeParse("../x").success).toBe(false);
    expect(agentFilePathSchema.safeParse("src/../../etc").success).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(agentFilePathSchema.safeParse("/abs").success).toBe(false);
    expect(agentFilePathSchema.safeParse("/etc/passwd").success).toBe(false);
  });

  it("rejects backslash separators", () => {
    expect(agentFilePathSchema.safeParse("a\\b").success).toBe(false);
  });

  it("rejects empty segments (double slash / trailing slash)", () => {
    expect(agentFilePathSchema.safeParse("a//b").success).toBe(false);
    expect(agentFilePathSchema.safeParse("a/").success).toBe(false);
    expect(agentFilePathSchema.safeParse("").success).toBe(false);
  });

  it("rejects '.' and '..' segments", () => {
    expect(agentFilePathSchema.safeParse("./a").success).toBe(false);
    expect(agentFilePathSchema.safeParse("a/./b").success).toBe(false);
  });

  it("rejects paths that touch forbidden directories", () => {
    expect(agentFilePathSchema.safeParse(".git").success).toBe(false);
    expect(agentFilePathSchema.safeParse("a/.git/config").success).toBe(false);
    expect(
      agentFilePathSchema.safeParse("node_modules/pkg/index.js").success,
    ).toBe(false);
  });

  it("rejects NUL bytes", () => {
    expect(agentFilePathSchema.safeParse("a\u0000b").success).toBe(false);
  });
});

describe("agentRuntimeStatusSchema", () => {
  it("normalizes SCREAMING_SNAKE_CASE to lower-case enum values", () => {
    expect(agentRuntimeStatusSchema.parse("RUNNING")).toBe("running");
    expect(agentRuntimeStatusSchema.parse("WAITING_FOR_PERMISSION")).toBe(
      "waiting_for_permission",
    );
  });

  it("rejects values outside the enum", () => {
    expect(agentRuntimeStatusSchema.safeParse("dancing").success).toBe(false);
  });
});

describe("agentClientMessageSchema", () => {
  it("accepts a valid heartbeat message", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "heartbeat", timestamp: 123 })
        .success,
    ).toBe(true);
  });

  it("accepts a hello message with the optional field omitted", () => {
    expect(agentClientMessageSchema.safeParse({ type: "hello" }).success).toBe(
      true,
    );
  });

  it("rejects a heartbeat missing its timestamp", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "heartbeat" }).success,
    ).toBe(false);
  });

  it("rejects an unknown message type", () => {
    expect(
      agentClientMessageSchema.safeParse({ type: "definitely-not-real" })
        .success,
    ).toBe(false);
  });
});

describe("agentServerMessageSchema", () => {
  it("accepts a valid error message", () => {
    expect(
      agentServerMessageSchema.safeParse({ type: "error", message: "boom" })
        .success,
    ).toBe(true);
  });

  it("accepts a ready message with a null current session", () => {
    expect(
      agentServerMessageSchema.safeParse({
        type: "ready",
        capabilities: { canRun: true, canManage: false, readOnly: false },
        runtimeStatus: "idle",
        currentSessionId: null,
        lastSequence: "0",
      }).success,
    ).toBe(true);
  });

  it("rejects an error message with an empty message string", () => {
    expect(
      agentServerMessageSchema.safeParse({ type: "error", message: "" })
        .success,
    ).toBe(false);
  });

  it("rejects an error message with no message field", () => {
    expect(agentServerMessageSchema.safeParse({ type: "error" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown server message type", () => {
    expect(agentServerMessageSchema.safeParse({ type: "nope" }).success).toBe(
      false,
    );
  });
});

describe("agentFileMutationResponseSchema", () => {
  it("discriminates a successful (ok) mutation", () => {
    const parsed = agentFileMutationResponseSchema.safeParse({
      status: "ok",
      result: { path: "src/x.ts", hash: "abc123" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("ok");
    }
  });

  it("discriminates a conflict result", () => {
    const parsed = agentFileMutationResponseSchema.safeParse({
      status: "conflict",
      conflict: {
        path: "src/x.ts",
        expectedHash: null,
        actualHash: "def456",
        message: "stale write",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("conflict");
    }
  });

  it("rejects an ok envelope that is missing its result", () => {
    expect(
      agentFileMutationResponseSchema.safeParse({
        status: "ok",
        conflict: { path: "x", expectedHash: null, actualHash: "h" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      agentFileMutationResponseSchema.safeParse({ status: "maybe" }).success,
    ).toBe(false);
  });
});
