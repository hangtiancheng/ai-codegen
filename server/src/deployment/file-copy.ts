import { existsSync, statSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { ErrorCode, HttpError } from "../common/index.js";

export const copyDirectoryFresh = async (sourceDir: string, targetDir: string): Promise<void> => {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new HttpError(ErrorCode.NotFoundError, "Source directory not found", 404);
  }
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, {
    dereference: false,
    errorOnExist: false,
    force: true,
    recursive: true,
  });
};
