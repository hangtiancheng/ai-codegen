import { z } from "zod";
import { readLegacySnapshotFile, writeJsonFile } from "./migration-files";
import { transformLegacySnapshot } from "./migration-transform";

const transformEnvSchema = z.object({
  MIGRATION_LEGACY_SNAPSHOT: z.string().min(1).default("tmp/migration/legacy-snapshot.json"),
  MIGRATION_TARGET_SNAPSHOT: z.string().min(1).default("tmp/migration/target-snapshot.json"),
});

const env = transformEnvSchema.parse(process.env);
const legacySnapshot = await readLegacySnapshotFile(env.MIGRATION_LEGACY_SNAPSHOT);
const targetSnapshot = transformLegacySnapshot(legacySnapshot);

await writeJsonFile(env.MIGRATION_TARGET_SNAPSHOT, targetSnapshot);
console.log(`Wrote transformed snapshot to ${env.MIGRATION_TARGET_SNAPSHOT}`);
