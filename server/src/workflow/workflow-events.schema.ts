import { z } from "zod";

export const workflowStepSchema = z.enum([
  "promptEnhance",
  "router",
  "codegen",
  "qualityCheck",
  "saveProject",
  "chatHistory",
]);

export const workflowStartEventSchema = z.object({
  data: z.object({ appId: z.string(), message: z.string() }),
  event: z.literal("workflow-start"),
});

export const workflowStepCompleteEventSchema = z.object({
  data: z.object({ step: workflowStepSchema, stepNumber: z.number().int().min(1) }),
  event: z.literal("step-complete"),
});

export const workflowChunkEventSchema = z.object({
  data: z.object({ d: z.string() }),
  event: z.literal("chunk"),
});

export const workflowErrorEventSchema = z.object({
  data: z.object({ code: z.number(), message: z.string() }),
  event: z.literal("business-error"),
});

export const workflowDoneEventSchema = z.object({
  data: z.object({ outputDir: z.string().optional() }),
  event: z.literal("done"),
});

export const workflowSseEventSchema = z.discriminatedUnion("event", [
  workflowStartEventSchema,
  workflowStepCompleteEventSchema,
  workflowChunkEventSchema,
  workflowErrorEventSchema,
  workflowDoneEventSchema,
]);

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowSseEvent = z.infer<typeof workflowSseEventSchema>;
