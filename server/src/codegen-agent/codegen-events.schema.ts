import { z } from "zod";

export const codegenMessageEventSchema = z.object({
  data: z.object({ d: z.string() }),
  event: z.literal("message"),
});

export const codegenToolEventSchema = z.object({
  data: z.object({
    detail: z.string().optional(),
    id: z.string().optional(),
    isError: z.boolean().optional(),
    name: z.string(),
    phase: z.enum(["start", "result"]),
  }),
  event: z.literal("tool"),
});

export const codegenErrorEventSchema = z.object({
  data: z.object({ code: z.number().int().optional(), message: z.string().min(1) }),
  event: z.literal("business-error"),
});

export const codegenDoneEventSchema = z.object({
  data: z.object({}),
  event: z.literal("done"),
});

export const codegenSseEventSchema = z.discriminatedUnion("event", [
  codegenMessageEventSchema,
  codegenToolEventSchema,
  codegenErrorEventSchema,
  codegenDoneEventSchema,
]);

export type CodegenSseEvent = z.infer<typeof codegenSseEventSchema>;
export type CodegenToolEvent = z.infer<typeof codegenToolEventSchema>;
