import { z } from "zod";
import { idSchema } from "../common/id.schema.js";
import { aiPromptSchema } from "../common/index.js";
import { pageRequestSchema } from "../common/pagination.schema.js";
import { CodegenType } from "../generated/prisma/enums.js";

export const codegenTypeSchema = z.enum(CodegenType);

export const appEntitySchema = z.object({
  appCover: z.string().nullable(),
  appName: z.string().nullable(),
  codegenType: codegenTypeSchema,
  createTime: z.date(),
  deployKey: z.string().nullable(),
  deployTime: z.date().nullable(),
  id: z.bigint(),
  initPrompt: z.string().nullable(),
  priority: z.number().int(),
  updateTime: z.date(),
  userId: z.bigint(),
});

export const appVoSchema = z.object({
  appCover: z.string().nullable(),
  appName: z.string().nullable(),
  codegenType: codegenTypeSchema,
  createTime: z.date(),
  deployKey: z.string().nullable(),
  deployTime: z.date().nullable(),
  id: z.string(),
  initPrompt: z.string().nullable(),
  priority: z.number().int(),
  updateTime: z.date(),
  userId: z.string(),
});

export const appAddSchema = z.object({
  initPrompt: aiPromptSchema,
});

export const appUpdateSchema = z.object({
  appName: z.string().min(1).max(256).optional(),
  id: idSchema,
});

export const appDeploySchema = z.object({
  appId: idSchema,
});

export const appDownloadParamSchema = z.object({
  appId: idSchema,
});

export const appIdQuerySchema = z.object({ id: idSchema });

export const appIdBodySchema = z.object({ id: idSchema });

export const appChatCodegenQuerySchema = z.object({
  appId: idSchema,
  message: aiPromptSchema,
});

export const appAdminUpdateSchema = z.object({
  appCover: z.string().max(512).optional(),
  appName: z.string().min(1).max(256).optional(),
  codegenType: codegenTypeSchema.optional(),
  id: idSchema,
  priority: z.number().int().min(0).max(99).optional(),
});

export const appPageQuerySchema = pageRequestSchema.extend({
  appName: z.string().min(1).max(256).optional(),
  codegenType: codegenTypeSchema.optional(),
  deployKey: z.string().min(1).max(64).optional(),
  id: idSchema.optional(),
  initPrompt: aiPromptSchema.optional(),
  priority: z.number().int().min(0).max(99).optional(),
  userId: idSchema.optional(),
});

export type AppEntity = z.infer<typeof appEntitySchema>;
export type AppVo = z.infer<typeof appVoSchema>;
export type AppAddRequest = z.infer<typeof appAddSchema>;
export type AppUpdateRequest = z.infer<typeof appUpdateSchema>;
export type AppChatCodegenQuery = z.infer<typeof appChatCodegenQuerySchema>;
export type AppDeployRequest = z.infer<typeof appDeploySchema>;
export type AppDownloadParam = z.infer<typeof appDownloadParamSchema>;
export type AppAdminUpdateRequest = z.infer<typeof appAdminUpdateSchema>;
export type AppPageQuery = z.infer<typeof appPageQuerySchema>;
