import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import type {
  CodeGenerator,
  QualityChecker,
  WorkflowChatWriter,
} from "./workflow-service";
import { createCodegenWorkflow } from "./workflow-service";

const tempDirs: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-workflow-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

const createChatWriter = (messages: string[]): WorkflowChatWriter => ({
  writeAiMessage: async (input) => {
    messages.push(`ai:${input.message}`);
  },
  writeUserMessage: async (input) => {
    messages.push(`user:${input.message}`);
  },
});

const collectEvents = async (
  workflow: ReturnType<typeof createCodegenWorkflow>,
) => {
  const events = [];
  for await (const event of workflow.execute({
    appId: 9n,
    codegenType: CodegenType.MULTI_FILES,
    userId: 1n,
    userPrompt: "build a page",
  })) {
    events.push(event);
  }
  return events;
};

describe("codegen workflow", () => {
  it("streams chunks, retries failed quality checks, saves files, and writes chat history", async () => {
    const rootDir = await createTempRoot();
    const messages: string[] = [];
    let generationCount = 0;
    const codeGenerator: CodeGenerator = {
      streamCode: async function* () {
        generationCount += 1;
        yield {
          content:
            generationCount === 1
              ? "bad"
              : "```html\n<div>ok</div>\n```\n```css\nbody{}\n```\n```js\nconsole.log('ok')\n```",
        };
      },
    };
    let checkCount = 0;
    const qualityChecker: QualityChecker = {
      check: async () => {
        checkCount += 1;
        return {
          message: checkCount === 1 ? "retry" : "passed",
          passed: checkCount > 1,
        };
      },
    };
    const workflow = createCodegenWorkflow({
      chatWriter: createChatWriter(messages),
      codeGenerator,
      maxAttempts: 2,
      outputRootDir: rootDir,
      qualityChecker,
    });

    const events = await collectEvents(workflow);

    expect(events.map((event) => event.event)).toContain("chunk");
    expect(events.at(-1)).toEqual({
      data: { outputDir: join(rootDir, "tmp", "code_output", "MULTI_FILES_9") },
      event: "done",
    });
    expect(messages[0]).toBe("user:build a page");
    expect(messages[1]).toContain("ai:```html");
    await expect(
      readFile(
        join(rootDir, "tmp", "code_output", "MULTI_FILES_9", "index.html"),
        "utf-8",
      ),
    ).resolves.toBe("<div>ok</div>");
  });

  it("does not save AI output when quality checks fail after bounded retries", async () => {
    const rootDir = await createTempRoot();
    const messages: string[] = [];
    const workflow = createCodegenWorkflow({
      chatWriter: createChatWriter(messages),
      codeGenerator: {
        streamCode: async function* () {
          yield { content: "bad" };
        },
      },
      maxAttempts: 1,
      outputRootDir: rootDir,
      qualityChecker: {
        check: async () => ({ message: "failed", passed: false }),
      },
    });

    const events = await collectEvents(workflow);

    expect(events.at(-1)).toEqual({
      data: { code: 50001, message: "failed" },
      event: "business-error",
    });
    expect(messages).toEqual(["user:build a page"]);
  });
});
