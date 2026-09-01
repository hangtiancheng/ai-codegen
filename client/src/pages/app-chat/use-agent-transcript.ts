import { useReducer, type Dispatch } from "react";

/**
 * Client-side transcript model for the bidirectional Agent workspace. It mirrors
 * the server WebSocket protocol in `server/src/agent-runtime/protocol.ts`:
 * persisted events arrive wrapped in `event` / `transcript_batch`, while live
 * token streaming (`assistant_delta`) and thinking (`agent_status`) are ephemeral
 * and are superseded by the persisted `assistant_message` / `thinking` events at
 * turn end.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AgentConnectionState =
  | "idle"
  | "connecting"
  | "handshaking"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type AgentRuntimeStatus =
  "idle" | "running" | "waiting" | "stopped" | "error";

export type AgentCommandCandidate = {
  readonly name: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly type: string;
};

export type AgentTranscriptEvent = {
  readonly sequence: string;
  readonly sessionId: string | undefined;
  readonly turnId: string | undefined;
  readonly kind: string;
  readonly payload: JsonValue;
  readonly createdAt: string | undefined;
};

export type AgentPermissionRequest = {
  readonly interactionId: string;
  readonly turnId: string | undefined;
  readonly toolName: string;
  readonly args: JsonValue;
  readonly description: string | undefined;
  readonly reason: string | undefined;
};

export type AgentQuestionOption = {
  readonly label: string;
  readonly description: string | undefined;
};

export type AgentQuestion = {
  readonly question: string;
  readonly header: string;
  readonly options: readonly AgentQuestionOption[];
  readonly multiSelect: boolean;
};

export type AgentQuestionRequest = {
  readonly interactionId: string;
  readonly turnId: string | undefined;
  readonly questions: readonly AgentQuestion[];
};

export type AgentCommandResult = {
  readonly id: number;
  readonly command: string;
  readonly requestId: string | undefined;
  readonly supported: boolean;
  readonly result: JsonValue | undefined;
  readonly error: string | undefined;
};

export type AgentError = {
  readonly id: number;
  readonly message: string;
  readonly code: string | undefined;
};

export type AgentTranscriptState = {
  readonly connectionState: AgentConnectionState;
  readonly runtimeStatus: AgentRuntimeStatus;
  readonly sessionId: string | undefined;
  readonly permissionMode: string | undefined;
  readonly readOnly: boolean;
  readonly lastSequence: string;
  readonly replaying: boolean;
  readonly events: ReadonlyArray<AgentTranscriptEvent>;
  readonly streamingText: string;
  readonly thinkingText: string;
  readonly statusDetail: string | undefined;
  readonly candidates: ReadonlyArray<AgentCommandCandidate>;
  readonly pendingPermission: AgentPermissionRequest | undefined;
  readonly pendingQuestion: AgentQuestionRequest | undefined;
  readonly commandResults: ReadonlyArray<AgentCommandResult>;
  readonly errors: ReadonlyArray<AgentError>;
  readonly filesRevision: number;
  readonly latestFileRevision: string | undefined;
};

export type AgentTranscriptAction =
  | {
      readonly type: "connection_changed";
      readonly state: AgentConnectionState;
    }
  | {
      readonly type: "ready";
      readonly sessionId: string;
      readonly readOnly: boolean;
      readonly permissionMode: string;
      readonly lastSequence: string;
    }
  | {
      readonly type: "candidates";
      readonly candidates: ReadonlyArray<AgentCommandCandidate>;
    }
  | {
      readonly type: "transcript_batch";
      readonly events: ReadonlyArray<AgentTranscriptEvent>;
    }
  | { readonly type: "event"; readonly event: AgentTranscriptEvent }
  | { readonly type: "assistant_delta"; readonly text: string }
  | { readonly type: "thinking_delta"; readonly text: string }
  | {
      readonly type: "runtime_status";
      readonly status: AgentRuntimeStatus;
      readonly detail: string | undefined;
    }
  | {
      readonly type: "permission_request";
      readonly request: AgentPermissionRequest;
    }
  | {
      readonly type: "question_request";
      readonly request: AgentQuestionRequest;
    }
  | { readonly type: "interaction_cleared"; readonly interactionId: string }
  | {
      readonly type: "command_result";
      readonly result: Omit<AgentCommandResult, "id">;
    }
  | { readonly type: "files_changed"; readonly revision: string | undefined }
  | {
      readonly type: "error";
      readonly message: string;
      readonly code: string | undefined;
    }
  | { readonly type: "dismiss_error"; readonly id: number }
  | { readonly type: "reset" };

export const initialAgentTranscriptState: AgentTranscriptState = {
  connectionState: "idle",
  runtimeStatus: "idle",
  sessionId: undefined,
  permissionMode: undefined,
  readOnly: false,
  lastSequence: "0",
  replaying: false,
  events: [],
  streamingText: "",
  thinkingText: "",
  statusDetail: undefined,
  candidates: [],
  pendingPermission: undefined,
  pendingQuestion: undefined,
  commandResults: [],
  errors: [],
  filesRevision: 0,
  latestFileRevision: undefined,
};

const MAX_COMMAND_RESULTS = 50;
const MAX_ERRORS = 20;
let sideItemId = 0;

/** Numeric comparison of decimal sequence strings (arbitrary length safe). */
export function compareAgentSequences(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function mergeEvents(
  current: ReadonlyArray<AgentTranscriptEvent>,
  incoming: ReadonlyArray<AgentTranscriptEvent>,
): AgentTranscriptEvent[] {
  const bySequence = new Map<string, AgentTranscriptEvent>();
  for (const event of current) bySequence.set(event.sequence, event);
  for (const event of incoming) bySequence.set(event.sequence, event);
  return [...bySequence.values()].sort((left, right) =>
    compareAgentSequences(left.sequence, right.sequence),
  );
}

// Persisted events that mark the boundary between live streaming and the
// authoritative transcript. Once these arrive the ephemeral buffers are cleared.
const TURN_BOUNDARY_KINDS = new Set([
  "user_message",
  "assistant_message",
  "loop_complete",
  "turn_complete",
]);

function applyEvents(
  state: AgentTranscriptState,
  incoming: ReadonlyArray<AgentTranscriptEvent>,
): AgentTranscriptState {
  const events = mergeEvents(state.events, incoming);
  const lastSequence = events.at(-1)?.sequence ?? state.lastSequence;
  const clearsBuffers = incoming.some((event) =>
    TURN_BOUNDARY_KINDS.has(event.kind),
  );
  return {
    ...state,
    events,
    lastSequence,
    ...(clearsBuffers && { streamingText: "", thinkingText: "" }),
  };
}

export function agentTranscriptReducer(
  state: AgentTranscriptState,
  action: AgentTranscriptAction,
): AgentTranscriptState {
  switch (action.type) {
    case "connection_changed":
      return { ...state, connectionState: action.state };
    case "ready":
      return {
        ...state,
        sessionId: action.sessionId,
        readOnly: action.readOnly,
        permissionMode: action.permissionMode,
        lastSequence: action.lastSequence,
        replaying: true,
      };
    case "candidates":
      return { ...state, candidates: action.candidates };
    case "transcript_batch":
      return { ...applyEvents(state, action.events), replaying: false };
    case "event":
      return applyEvents(state, [action.event]);
    case "assistant_delta":
      return { ...state, streamingText: state.streamingText + action.text };
    case "thinking_delta":
      return { ...state, thinkingText: state.thinkingText + action.text };
    case "runtime_status":
      return {
        ...state,
        runtimeStatus: action.status,
        statusDetail: action.detail,
        // Reaching a terminal status drops any half-streamed buffers.
        ...(action.status === "idle" && { thinkingText: "" }),
      };
    case "permission_request":
      return { ...state, pendingPermission: action.request };
    case "question_request":
      return { ...state, pendingQuestion: action.request };
    case "interaction_cleared": {
      const clearedPermission =
        state.pendingPermission?.interactionId === action.interactionId;
      const clearedQuestion =
        state.pendingQuestion?.interactionId === action.interactionId;
      if (!clearedPermission && !clearedQuestion) return state;
      return {
        ...state,
        ...(clearedPermission && { pendingPermission: undefined }),
        ...(clearedQuestion && { pendingQuestion: undefined }),
      };
    }
    case "command_result":
      return {
        ...state,
        commandResults: [
          ...state.commandResults.slice(-(MAX_COMMAND_RESULTS - 1)),
          { ...action.result, id: (sideItemId += 1) },
        ],
      };
    case "files_changed":
      return {
        ...state,
        filesRevision: state.filesRevision + 1,
        latestFileRevision: action.revision ?? state.latestFileRevision,
      };
    case "error":
      return {
        ...state,
        errors: [
          ...state.errors.slice(-(MAX_ERRORS - 1)),
          { id: (sideItemId += 1), message: action.message, code: action.code },
        ],
      };
    case "dismiss_error":
      return {
        ...state,
        errors: state.errors.filter((error) => error.id !== action.id),
      };
    case "reset":
      return {
        ...initialAgentTranscriptState,
        connectionState: state.connectionState,
        candidates: state.candidates,
      };
  }
}

export function isAgentBusy(status: AgentRuntimeStatus): boolean {
  return status === "running" || status === "waiting";
}

export type UseAgentTranscriptResult = {
  readonly state: AgentTranscriptState;
  readonly dispatch: Dispatch<AgentTranscriptAction>;
};

export function useAgentTranscript(): UseAgentTranscriptResult {
  const [state, dispatch] = useReducer(
    agentTranscriptReducer,
    initialAgentTranscriptState,
  );
  return { state, dispatch };
}
