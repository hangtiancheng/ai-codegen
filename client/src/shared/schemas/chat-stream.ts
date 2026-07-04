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

export const chatStreamEventNames = {
  message: "message",
  done: "done",
  businessError: "business-error",
} as const;

export type ChatStreamEventName =
  (typeof chatStreamEventNames)[keyof typeof chatStreamEventNames];
