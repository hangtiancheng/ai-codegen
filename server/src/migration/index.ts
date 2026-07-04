export {
  type LegacySnapshot,
  legacyAppSchema,
  legacyChatHistorySchema,
  legacySnapshotSchema,
  legacyUserSchema,
  type MigrationSnapshot,
  migrationSnapshotSchema,
  targetAppSchema,
  targetChatHistorySchema,
  targetUserSchema,
} from "./migration-schemas.js";
export { transformLegacySnapshot } from "./migration-transform.js";
export {
  type MigrationValidationReport,
  validateMigrationSnapshot,
} from "./migration-validate.js";
