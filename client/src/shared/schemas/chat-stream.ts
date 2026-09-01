import { z } from "zod";

export const chatStreamMessagePayloadSchema = z.object({
  d: z.string(),
});

export type ChatStreamMessagePayload = z.infer<
  typeof chatStreamMessagePayloadSchema
>;

export const chatStreamBusinessErrorPayloadSchema = z.object({
  code: z.number().int().optional(),
  message: z.string().min(1),
});

export type ChatStreamBusinessErrorPayload = z.infer<
  typeof chatStreamBusinessErrorPayloadSchema
>;

export const chatStreamDonePayloadSchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional();

export type ChatStreamDonePayload = z.infer<typeof chatStreamDonePayloadSchema>;

export const chatStreamToolPayloadSchema = z.object({
  name: z.string().min(1),
  phase: z.enum(["start", "result"]),
  id: z.string().optional(),
  detail: z.string().optional(),
  isError: z.boolean().optional(),
});

export type ChatStreamToolPayload = z.infer<typeof chatStreamToolPayloadSchema>;

export const chatStreamEventNames = {
  message: "message",
  tool: "tool",
  done: "done",
  businessError: "business-error",
} as const;

export type ChatStreamEventName =
  (typeof chatStreamEventNames)[keyof typeof chatStreamEventNames];
