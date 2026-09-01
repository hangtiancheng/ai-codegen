import { randomUUID } from "node:crypto";
import type { Decision } from "@swifty.js/swifty";
import type { AgentStores } from "./stores.js";
import type { PermissionDecision, QuestionAnswers } from "./types.js";

type PendingPermission = Readonly<{
  kind: "permission";
  resolve: (decision: PermissionDecision) => void;
  timer: NodeJS.Timeout;
}>;

type PendingQuestion = Readonly<{
  kind: "question";
  questionTexts: readonly string[];
  resolve: (answers: Record<string, string>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}>;

type Pending = PendingPermission | PendingQuestion;

export type PermissionRequestPayload = Readonly<{
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  description: string;
}>;

export type SwiftyQuestion = Readonly<{
  question: string;
  header: string;
  options: ReadonlyArray<{ label: string; description?: string | undefined }>;
  multiSelect: boolean;
}>;

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Coordinates human-in-the-loop interactions. Each request is persisted as an
 * AgentInteraction row and paired with an in-memory pending promise. Non-bypass
 * flows fail closed: a timeout, cancellation, or disconnect denies permission
 * requests and rejects question requests rather than silently proceeding.
 */
export const createInteractionBroker = (stores: AgentStores, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const pending = new Map<string, Pending>();

  const clear = (id: string): Pending | undefined => {
    const entry = pending.get(id);
    if (entry !== undefined) {
      clearTimeout(entry.timer);
      pending.delete(id);
    }
    return entry;
  };

  const requestPermission = async (input: {
    sessionId: string;
    turnId: string | null;
    payload: PermissionRequestPayload;
  }): Promise<{ interactionId: string; decision: Promise<PermissionDecision> }> => {
    const row = await stores.interactions.create({
      expiresTime: new Date(Date.now() + timeoutMs),
      requestPayload: input.payload,
      sessionId: input.sessionId,
      turnId: input.turnId,
      type: "PERMISSION",
    });
    const decision = new Promise<PermissionDecision>((resolve) => {
      const timer = setTimeout(() => {
        clear(row.id);
        void stores.interactions.answer(row.id, "EXPIRED", { decision: "deny" });
        resolve("deny");
      }, timeoutMs);
      pending.set(row.id, { kind: "permission", resolve, timer });
    });
    return { decision, interactionId: row.id };
  };

  const requestQuestions = async (input: {
    sessionId: string;
    turnId: string | null;
    questions: readonly SwiftyQuestion[];
  }): Promise<{ interactionId: string; answers: Promise<Record<string, string>> }> => {
    const row = await stores.interactions.create({
      expiresTime: new Date(Date.now() + timeoutMs),
      requestPayload: { questions: input.questions },
      sessionId: input.sessionId,
      turnId: input.turnId,
      type: "QUESTION",
    });
    const questionTexts = input.questions.map((question) => question.question);
    const answers = new Promise<Record<string, string>>((resolve, reject) => {
      const timer = setTimeout(() => {
        clear(row.id);
        void stores.interactions.answer(row.id, "EXPIRED", null);
        reject(new Error("Question timed out with no response"));
      }, timeoutMs);
      pending.set(row.id, { kind: "question", questionTexts, reject, resolve, timer });
    });
    return { answers, interactionId: row.id };
  };

  const resolvePermission = async (
    interactionId: string,
    decision: PermissionDecision,
  ): Promise<boolean> => {
    const entry = clear(interactionId);
    if (entry === undefined || entry.kind !== "permission") return false;
    await stores.interactions.answer(interactionId, "ANSWERED", { decision });
    entry.resolve(decision);
    return true;
  };

  const resolveQuestion = async (
    interactionId: string,
    answers: QuestionAnswers,
  ): Promise<boolean> => {
    const entry = clear(interactionId);
    if (entry === undefined || entry.kind !== "question") return false;
    const normalized: Record<string, string> = {};
    for (const questionText of entry.questionTexts) {
      const value = answers[questionText];
      normalized[questionText] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    }
    await stores.interactions.answer(interactionId, "ANSWERED", normalized);
    entry.resolve(normalized);
    return true;
  };

  /** Fail-closed cancellation for a whole session (abort, disconnect, dispose). */
  const cancelSession = async (sessionId: string): Promise<void> => {
    for (const [id, entry] of [...pending.entries()]) {
      clear(id);
      if (entry.kind === "permission") {
        entry.resolve("deny");
      } else {
        entry.reject(new Error("Interaction cancelled"));
      }
    }
    await stores.interactions.cancelPending(sessionId);
  };

  const hasPending = (): boolean => pending.size > 0;

  return {
    cancelSession,
    hasPending,
    newInteractionId: randomUUID,
    requestPermission,
    requestQuestions,
    resolvePermission,
    resolveQuestion,
  };
};

export type InteractionBroker = ReturnType<typeof createInteractionBroker>;

/** Convenience: turn a Swifty Decision into a permission request payload. */
export const toPermissionPayload = (
  toolName: string,
  args: Record<string, unknown>,
  decision: Decision,
  description: string,
): PermissionRequestPayload => ({
  args,
  description,
  reason: decision.reason,
  toolName,
});
