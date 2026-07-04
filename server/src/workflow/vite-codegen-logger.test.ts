import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileViteCodegenLogger } from "./vite-codegen-logger.js";

const tempDirs: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-vite-logs-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("vite codegen logger", () => {
  it("writes split files for a Vite codegen session", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const rootDir = await createTempRoot();
    const logger = createFileViteCodegenLogger(rootDir);

    const session = await logger.createSession({
      appId: "9",
      userId: "1",
      userPrompt: "build a dashboard",
    });
    await session.info({
      details: { files: ["package.json"] },
      message: "Generated project files saved",
      stage: "save-project",
    });
    await session.writeArtifact("build.log", "vite build output");

    const entries = await readdir(rootDir);
    expect(entries).toHaveLength(1);
    const sessionDirName = entries[0];
    if (sessionDirName === undefined)
      throw new Error("Expected a log session directory");
    const sessionDir = join(rootDir, sessionDirName);

    await expect(
      readFile(join(sessionDir, "input.json"), "utf-8"),
    ).resolves.toContain("build a dashboard");
    await expect(
      readFile(join(sessionDir, "events.ndjson"), "utf-8"),
    ).resolves.toContain('"stage":"save-project"');
    await expect(
      readFile(join(sessionDir, "build.log"), "utf-8"),
    ).resolves.toBe("vite build output");
  });
});
