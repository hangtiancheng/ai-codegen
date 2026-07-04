import { z } from "zod";
import { ChatMessageType } from "@/generated/prisma/enums";
import { idSchema } from "../common/id.schema";
import { pageRequestSchema } from "../common/pagination.schema";

export const chatMessageTypeSchema = z.enum(ChatMessageType);

export const chatHistoryEntitySchema = z.object({
  appId: z.bigint(),
  createTime: z.date(),
  id: z.bigint(),
  message: z.string(),
  messageType: chatMessageTypeSchema,
  updateTime: z.date(),
  userId: z.bigint(),
});

export const chatHistoryVoSchema = z.object({
  appId: z.string(),
  createTime: z.date(),
  id: z.string(),
  message: z.string(),
  messageType: chatMessageTypeSchema,
  userId: z.string(),
});

export const chatHistoryAppParamSchema = z.object({ appId: idSchema });

export const chatHistoryCursorQuerySchema = z.object({
  cursor: z.iso.datetime().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const chatHistoryPageQuerySchema = pageRequestSchema.extend({
  appId: idSchema.optional(),
  message: z.string().min(1).max(512).optional(),
  messageType: chatMessageTypeSchema.optional(),
  userId: idSchema.optional(),
});

export type ChatHistoryEntity = z.infer<typeof chatHistoryEntitySchema>;
export type ChatHistoryVo = z.infer<typeof chatHistoryVoSchema>;
export type ChatHistoryCursorQuery = z.infer<typeof chatHistoryCursorQuerySchema>;
export type ChatHistoryPageQuery = z.infer<typeof chatHistoryPageQuerySchema>;
