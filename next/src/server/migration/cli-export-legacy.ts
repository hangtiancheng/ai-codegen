import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import {
  type legacyAppSchema,
  type legacyChatHistorySchema,
  legacySnapshotSchema,
  type legacyUserSchema,
} from "./migration-schemas";

const exportEnvSchema = z.object({
  LEGACY_MYSQL_URL: z.string().min(1),
  MIGRATION_LEGACY_SNAPSHOT: z.string().min(1).default("tmp/migration/legacy-snapshot.json"),
});

type LegacyUserRow = RowDataPacket & z.input<typeof legacyUserSchema>;
type LegacyAppRow = RowDataPacket & z.input<typeof legacyAppSchema>;
type LegacyChatHistoryRow = RowDataPacket & z.input<typeof legacyChatHistorySchema>;

const queries = {
  apps: "select id, app_name as appName, app_cover as appCover, init_prompt as initPrompt, codegen_type as codegenType, deploy_key as deployKey, deploy_time as deployTime, priority, user_id as userId, edit_time as editTime, create_time as createTime, update_time as updateTime, is_delete as isDelete from app order by id",
  chatHistories:
    "select id, message, message_type as messageType, app_id as appId, user_id as userId, create_time as createTime, update_time as updateTime, is_delete as isDelete from chat_history order by id",
  users:
    "select id, user_account as userAccount, user_password as userPassword, username, user_avatar as userAvatar, user_profile as userProfile, user_role as userRole, edit_time as editTime, create_time as createTime, update_time as updateTime, is_delete as isDelete from user order by id",
} as const;

const env = exportEnvSchema.parse(process.env);
const connection = await createConnection(env.LEGACY_MYSQL_URL);

try {
  const [users] = await connection.query<LegacyUserRow[]>(queries.users);
  const [apps] = await connection.query<LegacyAppRow[]>(queries.apps);
  const [chatHistories] = await connection.query<LegacyChatHistoryRow[]>(queries.chatHistories);
  const snapshot = legacySnapshotSchema.parse({ apps, chatHistories, users });
  await mkdir(dirname(env.MIGRATION_LEGACY_SNAPSHOT), { recursive: true });
  await writeFile(env.MIGRATION_LEGACY_SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Exported legacy snapshot to ${env.MIGRATION_LEGACY_SNAPSHOT}`);
} finally {
  await connection.end();
}
