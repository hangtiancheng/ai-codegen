import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const SKIPPED_DIRS = new Set(["node_modules", "dist"]);

const listFiles = async (rootDir: string, currentDir: string): Promise<string[]> => {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith(".") && !SKIPPED_DIRS.has(entry.name))
      .map(async (entry) => {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) return listFiles(rootDir, fullPath);
        return [relative(rootDir, fullPath)];
      }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
};

/** Source files of the generated project, excluding dependencies and build output. */
export const listGeneratedFiles = async (projectDir: string): Promise<string[]> => {
  try {
    return await listFiles(projectDir, projectDir);
  } catch {
    return [];
  }
};
