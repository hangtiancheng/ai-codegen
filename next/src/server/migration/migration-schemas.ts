import { z } from "zod";
import { ChatMessageType, CodegenType, UserRole } from "@/generated/prisma/enums";

const legacyIdSchema = z
  .union([z.bigint(), z.number().int().min(0), z.string().regex(/^[0-9]+$/u)])
  .transform((value) => value.toString());

const legacyBooleanSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => Boolean(value));

const legacyDateSchema = z.coerce.date().transform((value) => value.toISOString());

const nullableStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const legacyUserSchema = z.object({
  createTime: legacyDateSchema,
  editTime: legacyDateSchema,
  id: legacyIdSchema,
  isDelete: legacyBooleanSchema,
  updateTime: legacyDateSchema,
  userAccount: z.string().min(1),
  userAvatar: nullableStringSchema,
  username: nullableStringSchema,
  userPassword: z.string().min(1),
  userProfile: nullableStringSchema,
  userRole: z.string().min(1),
});

export const legacyAppSchema = z.object({
  appCover: nullableStringSchema,
  appName: nullableStringSchema,
  codegenType: z.string().min(1),
  createTime: legacyDateSchema,
  deployKey: nullableStringSchema,
  deployTime: legacyDateSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  editTime: legacyDateSchema,
  id: legacyIdSchema,
  initPrompt: nullableStringSchema,
  isDelete: legacyBooleanSchema,
  priority: z.number().int().default(0),
  updateTime: legacyDateSchema,
  userId: legacyIdSchema,
});

export const legacyChatHistorySchema = z.object({
  appId: legacyIdSchema,
  createTime: legacyDateSchema,
  id: legacyIdSchema,
  isDelete: legacyBooleanSchema,
  message: z.string(),
  messageType: z.string().min(1),
  updateTime: legacyDateSchema,
  userId: legacyIdSchema,
});

export const legacySnapshotSchema = z.object({
  apps: z.array(legacyAppSchema),
  chatHistories: z.array(legacyChatHistorySchema),
  users: z.array(legacyUserSchema),
});

const targetDateSchema = z.string().min(1);

export const targetUserSchema = legacyUserSchema.extend({
  createTime: targetDateSchema,
  editTime: targetDateSchema,
  updateTime: targetDateSchema,
  userRole: z.enum(UserRole),
});

export const targetAppSchema = legacyAppSchema.extend({
  codegenType: z.enum(CodegenType),
  createTime: targetDateSchema,
  deployTime: targetDateSchema.nullable(),
  editTime: targetDateSchema,
  updateTime: targetDateSchema,
});

export const targetChatHistorySchema = legacyChatHistorySchema.extend({
  createTime: targetDateSchema,
  messageType: z.enum(ChatMessageType),
  updateTime: targetDateSchema,
});

export const migrationSnapshotSchema = z.object({
  apps: z.array(targetAppSchema),
  chatHistories: z.array(targetChatHistorySchema),
  users: z.array(targetUserSchema),
});

export type LegacySnapshot = z.infer<typeof legacySnapshotSchema>;
export type MigrationSnapshot = z.infer<typeof migrationSnapshotSchema>;
