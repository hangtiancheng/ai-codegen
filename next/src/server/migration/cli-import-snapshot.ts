import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "../database/index";
import { readMigrationSnapshotFile } from "./migration-files";
import type { MigrationSnapshot } from "./migration-schemas";
import { validateMigrationSnapshot } from "./migration-validate";

const importEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  MIGRATION_IMPORT_MODE: z.enum(["append", "replace"]).default("replace"),
  MIGRATION_TARGET_SNAPSHOT: z.string().min(1).default("tmp/migration/target-snapshot.json"),
});

const toDate = (value: string): Date => new Date(value);

type MigrationImportClient = Prisma.TransactionClient;

const resetPostgresSequences = async (db: MigrationImportClient): Promise<void> => {
  await db.$executeRaw`select setval(pg_get_serial_sequence('users', 'id'), coalesce((select max(id) from users), 1), (select count(*) > 0 from users))`;
  await db.$executeRaw`select setval(pg_get_serial_sequence('apps', 'id'), coalesce((select max(id) from apps), 1), (select count(*) > 0 from apps))`;
  await db.$executeRaw`select setval(pg_get_serial_sequence('chat_histories', 'id'), coalesce((select max(id) from chat_histories), 1), (select count(*) > 0 from chat_histories))`;
};

const writeSnapshot = async (
  db: MigrationImportClient,
  snapshot: MigrationSnapshot,
  mode: "append" | "replace",
): Promise<void> => {
  if (mode === "replace") {
    await db.chatHistory.deleteMany();
    await db.app.deleteMany();
    await db.user.deleteMany();
  }
  await db.user.createMany({
    data: snapshot.users.map((user) => ({
      ...user,
      createTime: toDate(user.createTime),
      editTime: toDate(user.editTime),
      id: BigInt(user.id),
      updateTime: toDate(user.updateTime),
    })),
  });
  await db.app.createMany({
    data: snapshot.apps.map((app) => ({
      ...app,
      createTime: toDate(app.createTime),
      deployTime: app.deployTime === null ? null : toDate(app.deployTime),
      editTime: toDate(app.editTime),
      id: BigInt(app.id),
      updateTime: toDate(app.updateTime),
      userId: BigInt(app.userId),
    })),
  });
  await db.chatHistory.createMany({
    data: snapshot.chatHistories.map((chatHistory) => ({
      ...chatHistory,
      appId: BigInt(chatHistory.appId),
      createTime: toDate(chatHistory.createTime),
      id: BigInt(chatHistory.id),
      updateTime: toDate(chatHistory.updateTime),
      userId: BigInt(chatHistory.userId),
    })),
  });
  await resetPostgresSequences(db);
};

const importSnapshot = async (snapshot: MigrationSnapshot): Promise<void> => {
  const env = importEnvSchema.parse(process.env);
  const db = createPrismaClient(env.DATABASE_URL);
  try {
    await db.$transaction((tx) => writeSnapshot(tx, snapshot, env.MIGRATION_IMPORT_MODE));
  } finally {
    await db.$disconnect();
  }
};

const env = importEnvSchema.parse(process.env);
const snapshot = await readMigrationSnapshotFile(env.MIGRATION_TARGET_SNAPSHOT);
const report = validateMigrationSnapshot(snapshot);
if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  await importSnapshot(snapshot);
  console.log(`Imported migration snapshot from ${env.MIGRATION_TARGET_SNAPSHOT}`);
}
