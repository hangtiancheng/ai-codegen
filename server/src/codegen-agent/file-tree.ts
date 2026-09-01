import { isUtf8 } from "node:buffer";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ErrorCode, HttpError } from "../common/index.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TREE_BYTES = 20 * 1024 * 1024;
const SKIPPED_NAMES = new Set(["node_modules", "dist", "build", ".git", ".swifty"]);

export type AppFileEncoding = "base64" | "utf8";

export type AppFileTree = Readonly<Record<string, AppDirectoryNode | AppFileNode>>;

export type AppDirectoryNode = Readonly<{ directory: AppFileTree }>;

export type AppFileNode = Readonly<{
  file: Readonly<{ contents: string; encoding: AppFileEncoding }>;
}>;

const shouldInclude = (name: string): boolean => !name.startsWith(".") && !SKIPPED_NAMES.has(name);

const readTree = async (rootDir: string, total: { bytes: number }): Promise<AppFileTree> => {
  const result: Record<string, AppDirectoryNode | AppFileNode> = {};
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!shouldInclude(entry.name)) continue;
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result[entry.name] = { directory: await readTree(fullPath, total) };
      continue;
    }
    if (!entry.isFile()) continue;
    const file = await readFile(fullPath);
    if (file.byteLength > MAX_FILE_BYTES) {
      throw new HttpError(ErrorCode.OperationError, `Generated file is too large: ${entry.name}`);
    }
    total.bytes += file.byteLength;
    if (total.bytes > MAX_TREE_BYTES) {
      throw new HttpError(ErrorCode.OperationError, "Generated project is too large to preview");
    }
    result[entry.name] = {
      file: {
        contents: isUtf8(file) ? file.toString("utf8") : file.toString("base64"),
        encoding: isUtf8(file) ? "utf8" : "base64",
      },
    };
  }
  return result;
};

export const buildAppFileTree = async (projectDir: string): Promise<AppFileTree> => {
  if (!existsSync(projectDir) || !(await stat(projectDir)).isDirectory()) {
    throw new HttpError(ErrorCode.NotFoundError, "Generated project not found", 404);
  }
  return readTree(projectDir, { bytes: 0 });
};
