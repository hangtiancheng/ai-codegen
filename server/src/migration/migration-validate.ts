import { type MigrationSnapshot, migrationSnapshotSchema } from "./migration-schemas.js";

export type MigrationValidationReport = Readonly<{
  counts: Readonly<{
    apps: number;
    chatHistories: number;
    users: number;
  }>;
  errors: readonly string[];
  ok: boolean;
}>;

const findDuplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
};

const addDuplicateErrors = (errors: string[], label: string, values: readonly string[]): void => {
  for (const value of findDuplicates(values)) {
    errors.push(`Duplicate ${label}: ${value}`);
  }
};

const addMissingReferenceErrors = (
  errors: string[],
  label: string,
  references: readonly string[],
  validIds: ReadonlySet<string>,
): void => {
  for (const reference of references) {
    if (!validIds.has(reference)) {
      errors.push(`Missing ${label}: ${reference}`);
    }
  }
};

export const validateMigrationSnapshot = (input: MigrationSnapshot): MigrationValidationReport => {
  const snapshot = migrationSnapshotSchema.parse(input);
  const errors: string[] = [];
  const userIds = new Set(snapshot.users.map((user) => user.id));
  const appIds = new Set(snapshot.apps.map((app) => app.id));

  addDuplicateErrors(
    errors,
    "user account",
    snapshot.users.map((user) => user.userAccount),
  );
  addDuplicateErrors(
    errors,
    "deploy key",
    snapshot.apps.flatMap((app) => (app.deployKey === null ? [] : [app.deployKey])),
  );
  addMissingReferenceErrors(
    errors,
    "app owner user id",
    snapshot.apps.map((app) => app.userId),
    userIds,
  );
  addMissingReferenceErrors(
    errors,
    "chat history user id",
    snapshot.chatHistories.map((chatHistory) => chatHistory.userId),
    userIds,
  );
  addMissingReferenceErrors(
    errors,
    "chat history app id",
    snapshot.chatHistories.map((chatHistory) => chatHistory.appId),
    appIds,
  );

  return {
    counts: {
      apps: snapshot.apps.length,
      chatHistories: snapshot.chatHistories.length,
      users: snapshot.users.length,
    },
    errors,
    ok: errors.length === 0,
  };
};
