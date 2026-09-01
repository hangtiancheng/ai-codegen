import { isUtf8 } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { ErrorCode, HttpError } from "../common/index.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TREE_BYTES = 20 * 1024 * 1024;
const MAX_WRITE_BYTES = 5 * 1024 * 1024;

/** Segments that must never be traversed or created through the file API. */
const FORBIDDEN_SEGMENTS = new Set([".git", ".swifty", ".env", "node_modules", "dist", "build"]);

const SKIPPED_TREE_NAMES = new Set(["node_modules", "dist", "build", ".git", ".swifty"]);

export type AppFileEncoding = "base64" | "utf8";

/**
 * Recursive project tree node. Mirrors the client `agentFileTreeNodeSchema`:
 * files carry their relative path, sha256 hash, and inline contents (utf8 or
 * base64); directories carry sorted children.
 */
export type AgentFileNode =
  | Readonly<{
      type: "file";
      path: string;
      name: string;
      encoding: AppFileEncoding;
      contents: string;
      hash: string;
    }>
  | Readonly<{
      type: "directory";
      path: string;
      name: string;
      children: readonly AgentFileNode[];
    }>;

const sha256 = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const shouldIncludeInTree = (name: string): boolean =>
  !name.startsWith(".") && !SKIPPED_TREE_NAMES.has(name);

/**
 * Validates a client-supplied path is a safe relative POSIX path within the
 * project. Rejects absolute paths, backslashes, `..`, and any forbidden segment
 * (.git/.swifty/.env/node_modules/dist/build). Returns the absolute target.
 */
export const validateRelativePath = (projectDir: string, relativePath: string): string => {
  const trimmed = relativePath.trim();
  if (trimmed.length === 0) {
    throw new HttpError(ErrorCode.ParamsError, "Path cannot be empty");
  }
  if (trimmed.includes("\\")) {
    throw new HttpError(ErrorCode.ParamsError, "Backslashes are not allowed in paths");
  }
  if (trimmed.startsWith("/")) {
    throw new HttpError(ErrorCode.ParamsError, "Absolute paths are not allowed");
  }
  const segments = trimmed.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new HttpError(ErrorCode.ParamsError, "Path traversal is not allowed");
    }
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new HttpError(ErrorCode.ForbiddenError, `Path segment is not allowed: ${segment}`, 403);
    }
  }
  const base = resolve(projectDir);
  const target = resolve(base, trimmed);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new HttpError(ErrorCode.ParamsError, "Path traversal is not allowed");
  }
  return target;
};

/** Rejects the write if any existing ancestor directory is a symlink. */
const assertNoSymlinkAncestors = async (projectDir: string, target: string): Promise<void> => {
  const base = resolve(projectDir);
  let current = dirname(target);
  while (current.length >= base.length && current.startsWith(base)) {
    if (existsSync(current)) {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new HttpError(ErrorCode.ForbiddenError, "Symlinked directories are not allowed", 403);
      }
    }
    if (current === base) break;
    current = dirname(current);
  }
};

const readNodes = async (
  absDir: string,
  relDir: string,
  total: { bytes: number },
): Promise<AgentFileNode[]> => {
  const result: AgentFileNode[] = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!shouldIncludeInTree(entry.name)) continue;
    const relPath = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
    const fullPath = join(absDir, entry.name);
    if (entry.isDirectory()) {
      result.push({
        type: "directory",
        path: relPath,
        name: entry.name,
        children: await readNodes(fullPath, relPath, total),
      });
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
    const utf8 = isUtf8(file);
    result.push({
      type: "file",
      path: relPath,
      name: entry.name,
      encoding: utf8 ? "utf8" : "base64",
      contents: utf8 ? file.toString("utf8") : file.toString("base64"),
      hash: sha256(file),
    });
  }
  // Directories first, then files, each alphabetical (matches the client sort).
  return result.sort((left, right) => {
    if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
};

/**
 * Builds the project tree rooted at an empty-path/empty-name directory node.
 * A missing project directory yields an empty root rather than a 404 so a
 * freshly created app opens an empty workspace instead of erroring.
 */
export const buildAppFileTree = async (projectDir: string): Promise<AgentFileNode> => {
  const empty: AgentFileNode = { type: "directory", path: "", name: "", children: [] };
  if (!existsSync(projectDir) || !(await stat(projectDir)).isDirectory()) return empty;
  return { ...empty, children: await readNodes(projectDir, "", { bytes: 0 }) };
};

export type WriteFileInput = Readonly<{
  path: string;
  contents: string;
  encoding?: AppFileEncoding | undefined;
  expectedHash?: string | null | undefined;
}>;

export type WriteFileResult =
  | Readonly<{ conflict: false; path: string; hash: string }>
  | Readonly<{ conflict: true; path: string; expectedHash: string | null; actualHash: string }>;

/**
 * Atomically writes a file. When `expectedHash` is a hash string and the file
 * exists, a mismatch returns a conflict result (optimistic concurrency) instead
 * of writing. A null/absent `expectedHash` writes unconditionally (create or
 * replace), which is what terminal-sync and new-file creation need.
 */
export const writeProjectFile = async (
  projectDir: string,
  input: WriteFileInput,
): Promise<WriteFileResult> => {
  const target = validateRelativePath(projectDir, input.path);
  await assertNoSymlinkAncestors(projectDir, target);

  const buffer = Buffer.from(input.contents, input.encoding === "base64" ? "base64" : "utf8");
  if (buffer.byteLength > MAX_WRITE_BYTES) {
    throw new HttpError(ErrorCode.ParamsError, "File contents exceed the size limit");
  }

  const expected = input.expectedHash ?? null;
  if (existsSync(target)) {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new HttpError(ErrorCode.ForbiddenError, "Target is not a regular file", 403);
    }
    if (expected !== null) {
      const current = sha256(await readFile(target));
      if (current !== expected) {
        return { conflict: true, path: input.path, expectedHash: expected, actualHash: current };
      }
    }
  }

  await mkdir(dirname(target), { recursive: true });
  const tempPath = `${target}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, buffer);
  await rename(tempPath, target);
  return { conflict: false, path: input.path, hash: sha256(buffer) };
};

export const createProjectDirectory = async (projectDir: string, path: string): Promise<void> => {
  const target = validateRelativePath(projectDir, path);
  await assertNoSymlinkAncestors(projectDir, target);
  await mkdir(target, { recursive: true });
};

export const renameProjectEntry = async (
  projectDir: string,
  from: string,
  to: string,
): Promise<void> => {
  const source = validateRelativePath(projectDir, from);
  const destination = validateRelativePath(projectDir, to);
  if (!existsSync(source)) {
    throw new HttpError(ErrorCode.NotFoundError, "Source path not found", 404);
  }
  await assertNoSymlinkAncestors(projectDir, destination);
  await mkdir(dirname(destination), { recursive: true });
  await rename(source, destination);
};

export const deleteProjectEntry = async (projectDir: string, path: string): Promise<void> => {
  const target = validateRelativePath(projectDir, path);
  if (!existsSync(target)) {
    throw new HttpError(ErrorCode.NotFoundError, "Path not found", 404);
  }
  await rm(target, { force: true, recursive: true });
};
