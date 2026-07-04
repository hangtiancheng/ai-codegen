import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveStaticFile } from "./static-file-service";

const tempDirs: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-static-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("static file service", () => {
  it("resolves existing static files with content type", async () => {
    const root = await createTempRoot();
    await writeFile(join(root, "index.html"), "<html></html>", "utf-8");

    expect(resolveStaticFile(root, "index.html")).toEqual({
      contentType: "text/html; charset=utf-8",
      filePath: join(root, "index.html"),
    });
  });

  it("rejects path traversal", async () => {
    const root = await createTempRoot();

    expect(() => resolveStaticFile(root, "../secret.txt")).toThrow(
      "Path traversal is not allowed",
    );
  });
});
