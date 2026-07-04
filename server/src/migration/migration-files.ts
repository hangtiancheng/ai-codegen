import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  type LegacySnapshot,
  legacySnapshotSchema,
  type MigrationSnapshot,
  migrationSnapshotSchema,
} from "./migration-schemas.js";

const readJsonFile = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf-8"));

export const readLegacySnapshotFile = async (path: string): Promise<LegacySnapshot> =>
  legacySnapshotSchema.parse(await readJsonFile(path));

export const readMigrationSnapshotFile = async (path: string): Promise<MigrationSnapshot> =>
  migrationSnapshotSchema.parse(await readJsonFile(path));

export const writeJsonFile = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};
