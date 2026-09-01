import { describe, expect, it } from "vitest";
import {
  agentTranscriptReducer,
  compareAgentSequences,
  initialAgentTranscriptState,
  isAgentBusy,
  type AgentRuntimeStatus,
  type AgentTranscriptAction,
  type AgentTranscriptEvent,
  type AgentTranscriptState,
} from "@/pages/app-chat/use-agent-transcript";

/** Fold a sequence of actions over the reducer starting from a given state. */
function reduce(
  actions: readonly AgentTranscriptAction[],
  start: AgentTranscriptState = initialAgentTranscriptState,
): AgentTranscriptState {
  return actions.reduce(agentTranscriptReducer, start);
}

function makeEvent(
  sequence: string,
  kind: string,
  extra: Partial<AgentTranscriptEvent> = {},
): AgentTranscriptEvent {
  return {
    sequence,
    sessionId: "session-1",
    turnId: "turn-1",
    kind,
    payload: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...extra,
  };
}

describe("compareAgentSequences", () => {
  it("orders shorter decimal strings before longer ones", () => {
    // Different length: length is the primary discriminator (BigInt-safe).
    expect(compareAgentSequences("9", "10")).toBe(-1);
    expect(compareAgentSequences("10", "9")).toBe(1);
    expect(compareAgentSequences("99", "100")).toBe(-1);
    expect(compareAgentSequences("1000", "999")).toBe(1);
  });

  it("compares equal-length decimal strings lexicographically", () => {
    expect(compareAgentSequences("5", "7")).toBe(-1);
    expect(compareAgentSequences("7", "5")).toBe(1);
    expect(compareAgentSequences("42", "43")).toBe(-1);
    expect(compareAgentSequences("130", "129")).toBe(1);
  });

  it("returns 0 for identical sequences", () => {
    expect(compareAgentSequences("0", "0")).toBe(0);
    expect(compareAgentSequences("123456789", "123456789")).toBe(0);
  });

  it("can drive a correct ascending sort", () => {
    const sorted = ["10", "2", "1", "100", "9"].sort(compareAgentSequences);
    expect(sorted).toEqual(["1", "2", "9", "10", "100"]);
  });
});

describe("isAgentBusy", () => {
  it("is true only for running and waiting", () => {
    expect(isAgentBusy("running")).toBe(true);
    expect(isAgentBusy("waiting")).toBe(true);
  });

  it("is false for idle, stopped and error", () => {
    const idle: AgentRuntimeStatus[] = ["idle", "stopped", "error"];
    for (const status of idle) expect(isAgentBusy(status)).toBe(false);
  });
});

describe("initialAgentTranscriptState", () => {
  it("has the documented defaults", () => {
    expect(initialAgentTranscriptState.connectionState).toBe("idle");
    expect(initialAgentTranscriptState.runtimeStatus).toBe("idle");
    expect(initialAgentTranscriptState.lastSequence).toBe("0");
    expect(initialAgentTranscriptState.replaying).toBe(false);
    expect(initialAgentTranscriptState.events).toEqual([]);
    expect(initialAgentTranscriptState.streamingText).toBe("");
    expect(initialAgentTranscriptState.thinkingText).toBe("");
    expect(initialAgentTranscriptState.readOnly).toBe(false);
    expect(initialAgentTranscriptState.filesRevision).toBe(0);
    expect(initialAgentTranscriptState.pendingPermission).toBeUndefined();
    expect(initialAgentTranscriptState.pendingQuestion).toBeUndefined();
  });
});

describe("agentTranscriptReducer", () => {
  it("connection_changed updates only connectionState", () => {
    const next = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "connection_changed",
      state: "connected",
    });
    expect(next.connectionState).toBe("connected");
    expect(next.runtimeStatus).toBe(initialAgentTranscriptState.runtimeStatus);
  });

  it("ready populates the session and enters replaying", () => {
    const next = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "ready",
      sessionId: "session-9",
      readOnly: true,
      permissionMode: "plan",
      lastSequence: "42",
    });
    expect(next.sessionId).toBe("session-9");
    expect(next.readOnly).toBe(true);
    expect(next.permissionMode).toBe("plan");
    expect(next.lastSequence).toBe("42");
    expect(next.replaying).toBe(true);
  });

  it("candidates replaces the candidate list", () => {
    const candidates = [
      { name: "/help", description: "Help", aliases: ["/h"], type: "local" },
    ];
    const next = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "candidates",
      candidates,
    });
    expect(next.candidates).toEqual(candidates);
  });

  it("event merges dedupe by sequence and stay ascending", () => {
    const state = reduce([
      {
        type: "transcript_batch",
        events: [
          makeEvent("2", "tool_use"),
          makeEvent("1", "tool_use"),
          makeEvent("10", "tool_use"),
        ],
      },
      { type: "event", event: makeEvent("3", "tool_use") },
    ]);
    expect(state.events.map((event) => event.sequence)).toEqual([
      "1",
      "2",
      "3",
      "10",
    ]);
    expect(state.lastSequence).toBe("10");
  });

  it("event with a duplicate sequence replaces the prior entry", () => {
    const state = reduce([
      {
        type: "event",
        event: makeEvent("5", "tool_use", { payload: "first" }),
      },
      {
        type: "event",
        event: makeEvent("5", "tool_use", { payload: "second" }),
      },
    ]);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.payload).toBe("second");
  });

  it("lastSequence tracks the highest merged sequence, not insertion order", () => {
    const state = reduce([
      { type: "event", event: makeEvent("100", "tool_use") },
      { type: "event", event: makeEvent("9", "tool_use") },
    ]);
    // "100" is greater than "9" (longer decimal string) so it stays last.
    expect(state.lastSequence).toBe("100");
    expect(state.events.at(-1)?.sequence).toBe("100");
  });

  it("transcript_batch clears the replaying flag", () => {
    const state = reduce([
      {
        type: "ready",
        sessionId: "s",
        readOnly: false,
        permissionMode: "default",
        lastSequence: "0",
      },
      { type: "transcript_batch", events: [makeEvent("1", "tool_use")] },
    ]);
    expect(state.replaying).toBe(false);
    expect(state.events).toHaveLength(1);
  });

  it("assistant_delta and thinking_delta accumulate their buffers", () => {
    const state = reduce([
      { type: "assistant_delta", text: "Hel" },
      { type: "assistant_delta", text: "lo" },
      { type: "thinking_delta", text: "th" },
      { type: "thinking_delta", text: "ink" },
    ]);
    expect(state.streamingText).toBe("Hello");
    expect(state.thinkingText).toBe("think");
  });

  it.each([
    "user_message",
    "assistant_message",
    "loop_complete",
    "turn_complete",
  ])("a %s event clears streaming and thinking buffers", (kind) => {
    const state = reduce([
      { type: "assistant_delta", text: "partial answer" },
      { type: "thinking_delta", text: "partial thought" },
      { type: "event", event: makeEvent("1", kind) },
    ]);
    expect(state.streamingText).toBe("");
    expect(state.thinkingText).toBe("");
    expect(state.events).toHaveLength(1);
  });

  it("a non-boundary event keeps the streaming buffers intact", () => {
    const state = reduce([
      { type: "assistant_delta", text: "keep me" },
      { type: "thinking_delta", text: "and me" },
      { type: "event", event: makeEvent("1", "tool_use") },
    ]);
    expect(state.streamingText).toBe("keep me");
    expect(state.thinkingText).toBe("and me");
  });

  it("runtime_status idle clears thinking but preserves streamingText", () => {
    const running = reduce([
      { type: "assistant_delta", text: "answer" },
      { type: "thinking_delta", text: "thoughts" },
      { type: "runtime_status", status: "running", detail: "working" },
    ]);
    expect(running.runtimeStatus).toBe("running");
    expect(running.statusDetail).toBe("working");
    expect(running.thinkingText).toBe("thoughts");

    const idle = agentTranscriptReducer(running, {
      type: "runtime_status",
      status: "idle",
      detail: undefined,
    });
    expect(idle.runtimeStatus).toBe("idle");
    expect(idle.thinkingText).toBe("");
    // Only the thinking buffer is dropped on idle; streamingText survives.
    expect(idle.streamingText).toBe("answer");
  });

  it("permission_request then matching interaction_cleared clears it", () => {
    const request = {
      interactionId: "int-1",
      turnId: "turn-1",
      toolName: "write",
      args: null,
      description: undefined,
      reason: undefined,
    };
    const withPending = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "permission_request",
      request,
    });
    expect(withPending.pendingPermission).toEqual(request);

    const cleared = agentTranscriptReducer(withPending, {
      type: "interaction_cleared",
      interactionId: "int-1",
    });
    expect(cleared.pendingPermission).toBeUndefined();
  });

  it("question_request then matching interaction_cleared clears it", () => {
    const request = {
      interactionId: "q-1",
      turnId: "turn-1",
      questions: [
        { question: "Pick one", header: "H", options: [], multiSelect: false },
      ],
    };
    const withPending = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "question_request",
      request,
    });
    expect(withPending.pendingQuestion).toEqual(request);

    const cleared = agentTranscriptReducer(withPending, {
      type: "interaction_cleared",
      interactionId: "q-1",
    });
    expect(cleared.pendingQuestion).toBeUndefined();
  });

  it("interaction_cleared with an unknown id returns the same state reference", () => {
    const request = {
      interactionId: "int-1",
      turnId: undefined,
      toolName: "write",
      args: null,
      description: undefined,
      reason: undefined,
    };
    const withPending = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "permission_request",
      request,
    });
    const untouched = agentTranscriptReducer(withPending, {
      type: "interaction_cleared",
      interactionId: "does-not-match",
    });
    expect(untouched).toBe(withPending);
    expect(untouched.pendingPermission).toEqual(request);
  });

  it("command_result appends entries with distinct increasing ids", () => {
    const state = reduce([
      {
        type: "command_result",
        result: {
          command: "a",
          requestId: "r1",
          supported: true,
          result: null,
          error: undefined,
        },
      },
      {
        type: "command_result",
        result: {
          command: "b",
          requestId: "r2",
          supported: false,
          result: null,
          error: "boom",
        },
      },
    ]);
    expect(state.commandResults).toHaveLength(2);
    const [first, second] = state.commandResults;
    expect(first?.command).toBe("a");
    expect(second?.command).toBe("b");
    expect(second?.id).toBeGreaterThan(first?.id);
  });

  it("files_changed increments the revision and tracks the latest hash", () => {
    const first = agentTranscriptReducer(initialAgentTranscriptState, {
      type: "files_changed",
      revision: "rev-1",
    });
    expect(first.filesRevision).toBe(1);
    expect(first.latestFileRevision).toBe("rev-1");

    const second = agentTranscriptReducer(first, {
      type: "files_changed",
      revision: undefined,
    });
    expect(second.filesRevision).toBe(2);
    // Undefined revision keeps the previously known revision.
    expect(second.latestFileRevision).toBe("rev-1");
  });

  it("error appends and dismiss_error removes by id", () => {
    const withErrors = reduce([
      { type: "error", message: "first", code: "E1" },
      { type: "error", message: "second", code: undefined },
    ]);
    expect(withErrors.errors).toHaveLength(2);
    const targetId = withErrors.errors[0]?.id;

    const dismissed = agentTranscriptReducer(withErrors, {
      type: "dismiss_error",
      id: targetId,
    });
    expect(dismissed.errors).toHaveLength(1);
    expect(dismissed.errors[0]?.message).toBe("second");
  });

  it("error list is capped at 20 entries keeping the most recent", () => {
    const actions: AgentTranscriptAction[] = Array.from(
      { length: 25 },
      (_, index) => ({
        type: "error",
        message: `err-${index}`,
        code: undefined,
      }),
    );
    const state = reduce(actions);
    expect(state.errors).toHaveLength(20);
    expect(state.errors.at(-1)?.message).toBe("err-24");
  });

  it("reset restores defaults but preserves connectionState and candidates", () => {
    const candidates = [
      { name: "/run", description: "Run", aliases: [], type: "local" },
    ];
    const populated = reduce([
      { type: "connection_changed", state: "connected" },
      { type: "candidates", candidates },
      { type: "event", event: makeEvent("1", "tool_use") },
      { type: "assistant_delta", text: "streaming" },
    ]);
    const reset = agentTranscriptReducer(populated, { type: "reset" });
    expect(reset.connectionState).toBe("connected");
    expect(reset.candidates).toEqual(candidates);
    expect(reset.events).toEqual([]);
    expect(reset.streamingText).toBe("");
    expect(reset.lastSequence).toBe("0");
  });
});
