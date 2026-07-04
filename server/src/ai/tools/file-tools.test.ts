import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDirReadTool,
  createFileDeleteTool,
  createFileModifyTool,
  createFileReadTool,
  createFileWriteTool,
} from "./file-tools.js";

const tempDirs: string[] = [];

const createWorkDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-tools-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("project file tools", () => {
  it("writes and reads project files", async () => {
    const workDir = await createWorkDir();
    const writeTool = createFileWriteTool(workDir);
    const readTool = createFileReadTool(workDir);

    await expect(
      writeTool.invoke({ content: "hello", filepath: "src/App.jsx" }),
    ).resolves.toBe("File written: src/App.jsx");

    await expect(readTool.invoke({ filePath: "src/App.jsx" })).resolves.toBe(
      "hello",
    );
  });

  it("rejects path traversal through tool invocation", async () => {
    const workDir = await createWorkDir();
    const writeTool = createFileWriteTool(workDir);

    await expect(
      writeTool.invoke({ content: "x", filepath: "../escape.txt" }),
    ).rejects.toThrow("Path traversal is not allowed");
  });

  it("modifies files by replacing the first matching string", async () => {
    const workDir = await createWorkDir();
    await writeFile(join(workDir, "index.html"), "<h1>Old</h1>", "utf-8");

    const modifyTool = createFileModifyTool(workDir);
    await expect(
      modifyTool.invoke({
        filePath: "index.html",
        replaceStr: "New",
        searchStr: "Old",
      }),
    ).resolves.toBe("File modified: index.html");

    await expect(readFile(join(workDir, "index.html"), "utf-8")).resolves.toBe(
      "<h1>New</h1>",
    );
  });

  it("refuses to delete protected files", async () => {
    const workDir = await createWorkDir();
    await writeFile(join(workDir, "package.json"), "{}", "utf-8");
    const deleteTool = createFileDeleteTool(workDir);

    await expect(deleteTool.invoke({ filePath: "package.json" })).resolves.toBe(
      "Cannot delete protected file: package.json",
    );
  });

  it("reads directory trees while hiding ignored folders", async () => {
    const workDir = await createWorkDir();
    await createFileWriteTool(workDir).invoke({
      content: "x",
      filepath: "src/App.jsx",
    });
    await createFileWriteTool(workDir).invoke({
      content: "x",
      filepath: "node_modules/a.js",
    });

    const tree = await createDirReadTool(workDir).invoke({});

    expect(tree).toContain("src/");
    expect(tree).toContain("App.jsx");
    expect(tree).not.toContain("node_modules");
  });
});
