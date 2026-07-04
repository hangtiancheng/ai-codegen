import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodegenType } from "../generated/prisma/enums.js";
import type { WorkflowSseEvent } from "./workflow-events.schema.js";
import { createFileViteCodegenLogger } from "./vite-codegen-logger.js";
import { createCodegenWorkflow } from "./workflow-service.js";

const tempDirs: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-workflow-error-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("workflow error logging", () => {
  it("logs final stream metadata for completed Vite code generation", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const rootDir = await createTempRoot();
    const logRootDir = join(rootDir, "logs");
    const workflow = createCodegenWorkflow({
      chatWriter: {
        writeAiMessage: async () => undefined,
        writeUserMessage: async () => undefined,
      },
      codeGenerator: {
        streamCode: async function* () {
          yield { content: "```tsx filename=./src/App.tsx\n" };
          yield {
            content: "",
            metadata: {
              response_metadata: { done_reason: "length", eval_count: 8192 },
              usage_metadata: { output_tokens: 8192 },
            },
          };
        },
      },
      maxAttempts: 1,
      qualityChecker: {
        check: async () => ({ message: "failed", passed: false }),
      },
      viteCodegenLogger: createFileViteCodegenLogger(logRootDir),
    });

    for await (const _event of workflow.execute({
      appId: 9n,
      codegenType: CodegenType.VITE_PROJECT,
      userId: 1n,
      userPrompt: "build a page",
    })) {
      // Exhaust the workflow so log files are flushed.
    }

    const [logDir] = await readdir(logRootDir);
    if (logDir === undefined) throw new Error("Expected a log directory");
    const events = await readFile(
      join(logRootDir, logDir, "events.ndjson"),
      "utf-8",
    );
    expect(events).toContain('"done_reason":"length"');
    expect(events).toContain('"eval_count":8192');
    expect(events).toContain('"output_tokens":8192');
  });

  it("logs partial Vite output when streaming code generation fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const rootDir = await createTempRoot();
    const logRootDir = join(rootDir, "logs");
    const workflow = createCodegenWorkflow({
      chatWriter: {
        writeAiMessage: async () => undefined,
        writeUserMessage: async () => undefined,
      },
      codeGenerator: {
        streamCode: async function* () {
          yield { content: "partial code" };
          throw new Error("stream failed");
        },
      },
      qualityChecker: {
        check: async () => ({ message: "unused", passed: true }),
      },
      viteCodegenLogger: createFileViteCodegenLogger(logRootDir),
    });

    const events: WorkflowSseEvent[] = [];
    for await (const event of workflow.execute({
      appId: 9n,
      codegenType: CodegenType.VITE_PROJECT,
      userId: 1n,
      userPrompt: "build a page",
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      data: { code: 50001, message: "Codegen workflow failed unexpectedly" },
      event: "business-error",
    });
    const [logDir] = await readdir(logRootDir);
    if (logDir === undefined) throw new Error("Expected a log directory");
    expect(logDir).toContain("vite-project-9");
    await expect(
      readFile(
        join(logRootDir, logDir, "attempt-1-partial-generated-code.md"),
        "utf-8",
      ),
    ).resolves.toBe("partial code");
    await expect(
      readFile(join(logRootDir, logDir, "workflow-error.json"), "utf-8"),
    ).resolves.toContain("stream failed");
  });
});
