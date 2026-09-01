import { z } from "zod";

const requestIdSchema = z.string().min(1).max(128);
const sessionIdSchema = z.uuid();
const turnIdSchema = z.uuid();
const sequenceSchema = z.string().regex(/^\d+$/u);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const agentClientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hello"),
      requestId: requestIdSchema.optional(),
      afterSequence: sequenceSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("run"),
      requestId: requestIdSchema,
      input: z.string().min(1).max(50_000),
      selectedElement: jsonObjectSchema.optional(),
      previewError: z.string().max(20_000).optional(),
      clientFileRevision: z.string().max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("abort"),
      requestId: requestIdSchema,
      turnId: turnIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("permission_response"),
      requestId: requestIdSchema,
      interactionId: sessionIdSchema,
      decision: z.enum(["allow", "deny"]),
      remember: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("question_response"),
      requestId: requestIdSchema,
      interactionId: sessionIdSchema,
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    })
    .strict(),
  z
    .object({
      type: z.literal("command_complete"),
      requestId: requestIdSchema,
      commandId: requestIdSchema,
      exitCode: z.number().int(),
      output: z.string().max(1_000_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime_action"),
      requestId: requestIdSchema,
      action: z.enum(["start", "stop", "restart", "install"]),
      command: z.string().max(10_000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("heartbeat"),
      requestId: requestIdSchema.optional(),
      timestamp: z.number().int().nonnegative(),
    })
    .strict(),
]);

export const agentTranscriptEventSchema = z
  .object({
    sessionId: sessionIdSchema,
    sequence: sequenceSchema,
    turnId: turnIdSchema.optional(),
    kind: z.string().min(1).max(128),
    payload: z.unknown(),
    createdAt: z.iso.datetime(),
  })
  .strict();

const structuredEventTypes = [
  "agent_status",
  "assistant_delta",
  "assistant_message",
  "tool_use",
  "tool_result",
  "usage",
  "turn_complete",
] as const;

const structuredAgentEventSchema = z
  .object({
    type: z.enum(structuredEventTypes),
    sessionId: sessionIdSchema.optional(),
    sequence: sequenceSchema.optional(),
    turnId: turnIdSchema.optional(),
    payload: z.unknown(),
  })
  .strict();

export const agentServerMessageSchema = z.union([
  z
    .object({
      type: z.literal("ready"),
      sessionId: sessionIdSchema,
      readOnly: z.boolean(),
      permissionMode: z.string(),
      lastSequence: sequenceSchema,
    })
    .strict(),
  z.object({ type: z.literal("event"), event: agentTranscriptEventSchema }).strict(),
  z
    .object({
      type: z.literal("transcript_batch"),
      events: z.array(agentTranscriptEventSchema).max(1_000),
    })
    .strict(),
  structuredAgentEventSchema,
  z
    .object({
      type: z.literal("permission_request"),
      interactionId: sessionIdSchema,
      sessionId: sessionIdSchema,
      turnId: turnIdSchema.optional(),
      request: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("question_request"),
      interactionId: sessionIdSchema,
      sessionId: sessionIdSchema,
      turnId: turnIdSchema.optional(),
      questions: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("command_result"),
      requestId: requestIdSchema.optional(),
      command: z.string(),
      supported: z.boolean(),
      result: z.unknown().optional(),
      error: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("candidates"),
      requestId: requestIdSchema.optional(),
      candidates: z.array(jsonObjectSchema),
    })
    .strict(),
  z
    .object({
      type: z.enum(["skill", "subagent", "team", "task"]),
      action: z.string(),
      payload: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime_status"),
      status: z.enum(["idle", "running", "waiting", "stopped", "error"]),
      sessionId: sessionIdSchema.optional(),
      turnId: turnIdSchema.optional(),
      detail: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("files_changed"),
      paths: z.array(z.string()),
      revision: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("error"),
      requestId: requestIdSchema.optional(),
      code: z.string(),
      message: z.string(),
      recoverable: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("heartbeat_ack"),
      requestId: requestIdSchema.optional(),
      timestamp: z.number().int().nonnegative(),
    })
    .strict(),
]);

export type AgentClientMessage = z.infer<typeof agentClientMessageSchema>;
export type AgentServerMessage = z.infer<typeof agentServerMessageSchema>;
export type AgentTranscriptEventMessage = z.infer<typeof agentTranscriptEventSchema>;
