import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CommandRunner } from "./project-builder.js";
import { buildViteProject } from "./project-builder.js";

const tempDirs: string[] = [];

const createProjectDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-builder-"));
  tempDirs.push(dir);
  await writeFile(join(dir, "package.json"), "{}", "utf-8");
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("project builder", () => {
  it("runs npm install and npm run build without shell command strings", async () => {
    const projectDir = await createProjectDir();
    const calls: string[] = [];
    const runner: CommandRunner = async (command, args, options) => {
      calls.push(`${command} ${args.join(" ")} ${options.cwd}`);
      if (args.join(" ") === "run build") await mkdir(join(projectDir, "dist"));
      return { exitCode: 0, stderr: "", stdout: "ok\n", timedOut: false };
    };

    const result = await buildViteProject(projectDir, runner);

    expect(result.success).toBe(true);
    expect(calls).toEqual([
      `npm install ${projectDir}`,
      `npm run build ${projectDir}`,
    ]);
  });

  it("fails when package.json is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-builder-empty-"));
    tempDirs.push(dir);

    await expect(buildViteProject(dir)).resolves.toEqual({
      logs: "package.json not found",
      success: false,
    });
  });

  it("returns captured logs when install fails", async () => {
    const projectDir = await createProjectDir();
    const runner: CommandRunner = async () => ({
      exitCode: 1,
      stderr: "install failed",
      stdout: "installing",
      timedOut: false,
    });

    await expect(buildViteProject(projectDir, runner)).resolves.toEqual({
      logs: "installinginstall failed",
      success: false,
    });
  });
});
