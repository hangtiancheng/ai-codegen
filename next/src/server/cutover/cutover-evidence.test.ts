import { describe, expect, it } from "vitest";
import type { CutoverCommandResult } from "./command-runner";
import { summarizeCutoverEvidence } from "./cutover-evidence";

const result = (name: string, required: boolean, ok: boolean): CutoverCommandResult => ({
  command: {
    args: [],
    command: "pnpm",
    name,
    required,
  },
  exitCode: ok ? 0 : 1,
  ok,
  stderr: "",
  stdout: "",
});

describe("cutover evidence", () => {
  it("fails only when required checks fail", () => {
    const summary = summarizeCutoverEvidence(
      [
        result("build", true, true),
        result("audit-prod", false, false),
        result("coverage", true, false),
      ],
      "2026-05-19T00:00:00.000Z",
    );

    expect(summary.ok).toBe(false);
    expect(summary.requiredFailures).toEqual(["coverage"]);
  });
});
