import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { saveGeneratedProject } from "./code-saver";

const tempDirs: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-saver-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("code saver", () => {
  it("writes parsed project files under the code output directory", async () => {
    const rootDir = await createTempRoot();

    const result = await saveGeneratedProject({
      appId: "42",
      codegenType: CodegenType.MULTI_FILES,
      parsedProject: {
        files: [{ content: "<html></html>", filename: "index.html" }],
      },
      rootDir,
    });

    await expect(
      readFile(join(result.outputDir, "index.html"), "utf-8"),
    ).resolves.toBe("<html></html>");
    expect(result.writtenFiles).toEqual(["index.html"]);
  });

  it("rejects path traversal in generated filenames", async () => {
    const rootDir = await createTempRoot();

    await expect(
      saveGeneratedProject({
        appId: "42",
        codegenType: CodegenType.VITE_PROJECT,
        parsedProject: {
          files: [{ content: "secret", filename: "../outside.txt" }],
        },
        rootDir,
      }),
    ).rejects.toThrow("Path traversal is not allowed");
  });
});
