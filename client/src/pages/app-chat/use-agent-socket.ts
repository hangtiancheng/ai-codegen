import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { z } from "zod";
import { type AppId } from "@/shared/schemas";
import { buildAgentSocketUrl } from "./agent-socket-url";
import {
  type AgentConnectionState,
  type AgentQuestion,
  type AgentTranscriptAction,
  type AgentTranscriptEvent,
  type JsonValue,
} from "./use-agent-transcript";

const reconnectBaseDelayMs = 500;
const reconnectMaximumDelayMs = 15_000;
const heartbeatIntervalMs = 20_000;
const heartbeatAckTimeoutMs = 10_000;

// ---------------------------------------------------------------------------
// Server -> client wire schemas (mirror server/src/agent-runtime/protocol.ts).
// Payloads stay permissive; only the fields the client reads are validated.
// ---------------------------------------------------------------------------

const jsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

const wireEventSchema = z.object({
  sessionId: z.string().optional(),
  sequence: z.string(),
  turnId: z.string().optional(),
  kind: z.string().min(1),
  payload: jsonSchema.optional(),
  createdAt: z.string().optional(),
});

const runtimeStatusValues = [
  "idle",
  "running",
  "waiting",
  "stopped",
  "error",
] as const;

const questionSchema = z.object({
  question: z.string(),
  header: z.string().default(""),
  options: z
    .array(z.object({ label: z.string(), description: z.string().optional() }))
    .default([]),
  multiSelect: z.boolean().default(false),
});

const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    sessionId: z.string(),
    readOnly: z.boolean(),
    permissionMode: z.string(),
    lastSequence: z.string(),
  }),
  z.object({
    type: z.literal("candidates"),
    candidates: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().default(""),
          aliases: z.array(z.string()).default([]),
          type: z.string().default("prompt"),
        }),
      )
      .default([]),
  }),
  z.object({
    type: z.literal("transcript_batch"),
    events: z.array(wireEventSchema).default([]),
  }),
  z.object({ type: z.literal("event"), event: wireEventSchema }),
  z.object({
    type: z.literal("assistant_delta"),
    payload: z.object({ text: z.string() }),
  }),
  z.object({
    type: z.literal("agent_status"),
    payload: z.object({
      phase: z.string().optional(),
      text: z.string().optional(),
      toolName: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("runtime_status"),
    status: z.enum(runtimeStatusValues),
    sessionId: z.string().optional(),
    turnId: z.string().optional(),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("permission_request"),
    interactionId: z.string(),
    sessionId: z.string().optional(),
    turnId: z.string().optional(),
    request: z.object({
      toolName: z.string(),
      args: jsonSchema.optional(),
      reason: z.string().optional(),
      description: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("question_request"),
    interactionId: z.string(),
    sessionId: z.string().optional(),
    turnId: z.string().optional(),
    questions: z.array(questionSchema).default([]),
  }),
  z.object({
    type: z.literal("command_result"),
    command: z.string(),
    requestId: z.string().optional(),
    supported: z.boolean(),
    result: jsonSchema.optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal("files_changed"),
    paths: z.array(z.string()).default([]),
    revision: z.string().optional(),
  }),
  z.object({
    type: z.literal("error"),
    code: z.string().optional(),
    message: z.string(),
    recoverable: z.boolean().optional(),
    requestId: z.string().optional(),
  }),
  z.object({
    type: z.literal("heartbeat_ack"),
    timestamp: z.number().optional(),
    requestId: z.string().optional(),
  }),
]);

type ServerMessage = z.infer<typeof serverMessageSchema>;

const toTranscriptEvent = (
  event: z.infer<typeof wireEventSchema>,
): AgentTranscriptEvent => ({
  sequence: event.sequence,
  sessionId: event.sessionId,
  turnId: event.turnId,
  kind: event.kind,
  payload: event.payload ?? null,
  createdAt: event.createdAt,
});

const toQuestion = (
  question: z.infer<typeof questionSchema>,
): AgentQuestion => ({
  question: question.question,
  header: question.header,
  options: question.options.map((option) => ({
    label: option.label,
    description: option.description,
  })),
  multiSelect: question.multiSelect,
});

// ---------------------------------------------------------------------------
// Client -> server messages.
// ---------------------------------------------------------------------------

export type AgentSelectedElement = Record<string, unknown>;

export type AgentRunOptions = {
  readonly selectedElement?: AgentSelectedElement;
  readonly previewError?: string;
  readonly clientFileRevision?: string;
};

export type PermissionDecision = "allow" | "deny" | "allowAlways";
export type QuestionAnswers = Record<string, string | string[]>;

type ClientMessage =
  | {
      readonly type: "hello";
      readonly requestId: string;
      readonly afterSequence: string;
    }
  | {
      readonly type: "run";
      readonly requestId: string;
      readonly input: string;
      readonly selectedElement?: AgentSelectedElement;
      readonly previewError?: string;
      readonly clientFileRevision?: string;
    }
  | {
      readonly type: "abort";
      readonly requestId: string;
      readonly turnId?: string;
    }
  | {
      readonly type: "permission_response";
      readonly requestId: string;
      readonly interactionId: string;
      readonly decision: "allow" | "deny";
      readonly remember?: boolean;
    }
  | {
      readonly type: "question_response";
      readonly requestId: string;
      readonly interactionId: string;
      readonly answers: QuestionAnswers;
    }
  | {
      readonly type: "heartbeat";
      readonly requestId: string;
      readonly timestamp: number;
    };

const newRequestId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r-${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;

export type UseAgentSocketOptions = {
  readonly appId: AppId | undefined;
  readonly enabled?: boolean;
  readonly lastSequence: string;
  readonly dispatch: Dispatch<AgentTranscriptAction>;
};

export type UseAgentSocketResult = {
  readonly connectionState: AgentConnectionState;
  readonly connect: () => void;
  readonly disconnect: () => void;
  readonly run: (input: string, options?: AgentRunOptions) => boolean;
  readonly abort: (turnId?: string) => boolean;
  readonly respondPermission: (
    interactionId: string,
    decision: PermissionDecision,
  ) => boolean;
  readonly respondQuestion: (
    interactionId: string,
    answers: QuestionAnswers,
  ) => boolean;
};

export function useAgentSocket({
  appId,
  enabled = true,
  lastSequence,
  dispatch,
}: UseAgentSocketOptions): UseAgentSocketResult {
  const [connectionState, setConnectionState] =
    useState<AgentConnectionState>("idle");
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const reconnectAttemptRef = useRef(0);
  const manualDisconnectRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const lastSequenceRef = useRef(lastSequence);
  const connectRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    lastSequenceRef.current = lastSequence;
  }, [lastSequence]);

  const transition = useCallback(
    (next: AgentConnectionState): void => {
      if (!mountedRef.current) return;
      setConnectionState(next);
      dispatch({ type: "connection_changed", state: next });
    },
    [dispatch],
  );

  const clearHeartbeat = useCallback((): void => {
    if (heartbeatTimerRef.current !== undefined) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
    if (heartbeatTimeoutRef.current !== undefined) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
  }, []);

  const clearReconnect = useCallback((): void => {
    if (reconnectTimerRef.current === undefined) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = undefined;
  }, []);

  const sendNow = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage): void => {
      switch (message.type) {
        case "ready":
          reconnectAttemptRef.current = 0;
          transition("connected");
          dispatch({
            type: "ready",
            sessionId: message.sessionId,
            readOnly: message.readOnly,
            permissionMode: message.permissionMode,
            lastSequence: message.lastSequence,
          });
          return;
        case "candidates":
          dispatch({
            type: "candidates",
            candidates: message.candidates.map((candidate) => ({
              name: candidate.name,
              description: candidate.description,
              aliases: candidate.aliases,
              type: candidate.type,
            })),
          });
          return;
        case "transcript_batch":
          dispatch({
            type: "transcript_batch",
            events: message.events.map(toTranscriptEvent),
          });
          return;
        case "event":
          dispatch({ type: "event", event: toTranscriptEvent(message.event) });
          return;
        case "assistant_delta":
          dispatch({ type: "assistant_delta", text: message.payload.text });
          return;
        case "agent_status":
          if (
            message.payload.phase === "thinking" &&
            message.payload.text !== undefined
          ) {
            dispatch({ type: "thinking_delta", text: message.payload.text });
          }
          return;
        case "runtime_status":
          dispatch({
            type: "runtime_status",
            status: message.status,
            detail: message.detail,
          });
          return;
        case "permission_request":
          dispatch({
            type: "permission_request",
            request: {
              interactionId: message.interactionId,
              turnId: message.turnId,
              toolName: message.request.toolName,
              args: message.request.args ?? null,
              description: message.request.description,
              reason: message.request.reason,
            },
          });
          return;
        case "question_request":
          dispatch({
            type: "question_request",
            request: {
              interactionId: message.interactionId,
              turnId: message.turnId,
              questions: message.questions.map(toQuestion),
            },
          });
          return;
        case "command_result":
          dispatch({
            type: "command_result",
            result: {
              command: message.command,
              requestId: message.requestId,
              supported: message.supported,
              result: message.result,
              error: message.error,
            },
          });
          return;
        case "files_changed":
          dispatch({ type: "files_changed", revision: message.revision });
          return;
        case "error":
          dispatch({
            type: "error",
            message: message.message,
            code: message.code,
          });
          return;
        case "heartbeat_ack":
          if (heartbeatTimeoutRef.current !== undefined) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = undefined;
          }
          return;
      }
    },
    [dispatch, transition],
  );

  const startHeartbeat = useCallback(
    (socket: WebSocket, generation: number): void => {
      clearHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        if (
          generationRef.current !== generation ||
          socket.readyState !== WebSocket.OPEN
        ) {
          return;
        }
        if (heartbeatTimeoutRef.current !== undefined) {
          socket.close(4000, "heartbeat timeout");
          return;
        }
        socket.send(
          JSON.stringify({
            type: "heartbeat",
            requestId: newRequestId(),
            timestamp: Date.now(),
          }),
        );
        heartbeatTimeoutRef.current = setTimeout(() => {
          heartbeatTimeoutRef.current = undefined;
          if (
            generationRef.current === generation &&
            socket.readyState === WebSocket.OPEN
          ) {
            socket.close(4000, "heartbeat timeout");
          }
        }, heartbeatAckTimeoutMs);
      }, heartbeatIntervalMs);
    },
    [clearHeartbeat],
  );

  const scheduleReconnect = useCallback((): void => {
    if (
      !mountedRef.current ||
      manualDisconnectRef.current ||
      !enabled ||
      appId === undefined ||
      reconnectTimerRef.current !== undefined
    ) {
      return;
    }
    transition("reconnecting");
    const attempt = reconnectAttemptRef.current;
    reconnectAttemptRef.current += 1;
    const delay = Math.min(
      reconnectMaximumDelayMs,
      reconnectBaseDelayMs * 2 ** attempt,
    );
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = undefined;
      connectRef.current();
    }, delay);
  }, [appId, enabled, transition]);

  const connect = useCallback((): void => {
    if (!mountedRef.current || !enabled || appId === undefined) return;
    const current = socketRef.current;
    if (
      current?.readyState === WebSocket.OPEN ||
      current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    clearReconnect();
    clearHeartbeat();
    manualDisconnectRef.current = false;
    transition(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let socket: WebSocket;
    try {
      socket = new WebSocket(buildAgentSocketUrl(appId));
    } catch (cause) {
      dispatch({
        type: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to open the agent socket",
        code: "socket_create_failed",
      });
      scheduleReconnect();
      return;
    }
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      if (generationRef.current !== generation) return;
      transition("handshaking");
      socket.send(
        JSON.stringify({
          type: "hello",
          requestId: newRequestId(),
          afterSequence: lastSequenceRef.current,
        }),
      );
      startHeartbeat(socket, generation);
    });
    socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (generationRef.current !== generation) return;
      if (typeof event.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const result = serverMessageSchema.safeParse(parsed);
      if (result.success) handleMessage(result.data);
    });
    socket.addEventListener("error", () => {
      if (generationRef.current !== generation) return;
      dispatch({
        type: "error",
        message: "Agent socket connection failed",
        code: "socket_error",
      });
    });
    socket.addEventListener("close", () => {
      if (generationRef.current !== generation) return;
      socketRef.current = undefined;
      clearHeartbeat();
      if (manualDisconnectRef.current || !mountedRef.current) {
        transition("disconnected");
        return;
      }
      scheduleReconnect();
    });
  }, [
    appId,
    clearHeartbeat,
    clearReconnect,
    dispatch,
    enabled,
    handleMessage,
    scheduleReconnect,
    startHeartbeat,
    transition,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback((): void => {
    manualDisconnectRef.current = true;
    clearReconnect();
    clearHeartbeat();
    generationRef.current += 1;
    const socket = socketRef.current;
    socketRef.current = undefined;
    if (
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, "client disconnected");
    }
    transition("disconnected");
  }, [clearHeartbeat, clearReconnect, transition]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && appId !== undefined) connectRef.current();
    return () => {
      mountedRef.current = false;
      manualDisconnectRef.current = true;
      clearReconnect();
      clearHeartbeat();
      generationRef.current += 1;
      const socket = socketRef.current;
      socketRef.current = undefined;
      if (
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "component unmounted");
      }
    };
  }, [appId, clearHeartbeat, clearReconnect, enabled]);

  const run = useCallback(
    (input: string, options: AgentRunOptions = {}): boolean => {
      const trimmed = input.trim();
      if (trimmed.length === 0) return false;
      return sendNow({
        type: "run",
        requestId: newRequestId(),
        input: trimmed,
        ...(options.selectedElement !== undefined && {
          selectedElement: options.selectedElement,
        }),
        ...(options.previewError !== undefined && {
          previewError: options.previewError,
        }),
        ...(options.clientFileRevision !== undefined && {
          clientFileRevision: options.clientFileRevision,
        }),
      });
    },
    [sendNow],
  );

  const abort = useCallback(
    (turnId?: string): boolean =>
      sendNow({
        type: "abort",
        requestId: newRequestId(),
        ...(turnId !== undefined && { turnId }),
      }),
    [sendNow],
  );

  const respondPermission = useCallback(
    (interactionId: string, decision: PermissionDecision): boolean =>
      sendNow({
        type: "permission_response",
        requestId: newRequestId(),
        interactionId,
        decision: decision === "deny" ? "deny" : "allow",
        ...(decision === "allowAlways" && { remember: true }),
      }),
    [sendNow],
  );

  const respondQuestion = useCallback(
    (interactionId: string, answers: QuestionAnswers): boolean =>
      sendNow({
        type: "question_response",
        requestId: newRequestId(),
        interactionId,
        answers,
      }),
    [sendNow],
  );

  return {
    connectionState,
    connect,
    disconnect,
    run,
    abort,
    respondPermission,
    respondQuestion,
  };
}
