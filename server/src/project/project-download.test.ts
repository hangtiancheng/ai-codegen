import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listProjectDownloadEntries } from "./project-download.js";

const tempDirs: string[] = [];

const createProjectDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-download-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "src"), { recursive: true });
  await mkdir(join(dir, "node_modules"), { recursive: true });
  await mkdir(join(dir, ".vscode"), { recursive: true });
  await writeFile(join(dir, "src", "App.jsx"), "app", "utf-8");
  await writeFile(join(dir, "package.json"), "{}", "utf-8");
  await writeFile(join(dir, "node_modules", "dep.js"), "dep", "utf-8");
  await writeFile(join(dir, ".env"), "secret", "utf-8");
  await writeFile(join(dir, "debug.log"), "log", "utf-8");
  await writeFile(join(dir, ".vscode", "settings.json"), "{}", "utf-8");
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("project download entries", () => {
  it("includes project files and excludes generated or sensitive content", async () => {
    const projectDir = await createProjectDir();

    const entries = await listProjectDownloadEntries(projectDir);
    const archivePaths = entries.map((entry) => entry.archivePath).sort();

    expect(archivePaths).toEqual(["package.json", "src/App.jsx"]);
  });

  it("rejects missing project directories", async () => {
    await expect(
      listProjectDownloadEntries("/missing/project"),
    ).rejects.toThrow("Project directory not found");
  });
});
