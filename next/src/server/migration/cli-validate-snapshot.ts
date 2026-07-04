import { z } from "zod";
import { readMigrationSnapshotFile, writeJsonFile } from "./migration-files";
import { validateMigrationSnapshot } from "./migration-validate";

const validateEnvSchema = z.object({
  MIGRATION_REPORT: z.string().min(1).default("tmp/migration/validation-report.json"),
  MIGRATION_TARGET_SNAPSHOT: z.string().min(1).default("tmp/migration/target-snapshot.json"),
});

const env = validateEnvSchema.parse(process.env);
const snapshot = await readMigrationSnapshotFile(env.MIGRATION_TARGET_SNAPSHOT);
const report = validateMigrationSnapshot(snapshot);

await writeJsonFile(env.MIGRATION_REPORT, report);
console.log(`Wrote migration validation report to ${env.MIGRATION_REPORT}`);
if (!report.ok) {
  process.exitCode = 1;
}
