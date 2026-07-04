import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { ErrorCode, HttpError } from "../common/index";
import { resolveInsideBase } from "./project-path";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export type StaticFileResult = Readonly<{
  contentType: string;
  filePath: string;
}>;

export const resolveStaticFile = (baseDir: string, relativePath: string): StaticFileResult => {
  const filePath = resolveInsideBase(baseDir, relativePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(ErrorCode.NotFoundError, "Static file not found", 404);
  }
  return {
    contentType: CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    filePath,
  };
};
