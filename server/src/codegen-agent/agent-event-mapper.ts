import { type AgentEvent, contentToText } from "@swifty.js/swifty";
import { ErrorCode } from "../common/index.js";
import type { CodegenSseEvent } from "./codegen-events.schema.js";

const DETAIL_MAX_LENGTH = 160;

const DETAIL_ARG_KEYS = ["file_path", "path", "pattern", "command"] as const;

export type CodegenOutcome = "pending" | "end_turn" | "interrupted" | "error" | "other";

export type AgentEventCollector = Readonly<{
  errorMessage: () => string | undefined;
  map: (event: AgentEvent) => CodegenSseEvent | undefined;
  narration: () => string;
  outcome: () => CodegenOutcome;
  usage: () => Readonly<{ input: number; output: number }>;
}>;

const truncate = (value: string): string => {
  const collapsed = value.replaceAll(/\s+/gu, " ").trim();
  return collapsed.length <= DETAIL_MAX_LENGTH
    ? collapsed
    : `${collapsed.slice(0, DETAIL_MAX_LENGTH)}…`;
};

const extractDetail = (args: Record<string, unknown>): string | undefined => {
  for (const key of DETAIL_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim().length > 0) return truncate(value);
  }
  return undefined;
};

export const createAgentEventCollector = (): AgentEventCollector => {
  const narrationParts: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let outcome: CodegenOutcome = "pending";
  let errorMessage: string | undefined;

  const map = (event: AgentEvent): CodegenSseEvent | undefined => {
    switch (event.type) {
      case "stream_text": {
        narrationParts.push(event.text);
        return { data: { d: event.text }, event: "message" };
      }
      case "tool_use": {
        const detail = extractDetail(event.args);
        return {
          data: {
            id: event.toolId,
            name: event.toolName,
            phase: "start",
            ...(detail !== undefined && { detail }),
          },
          event: "tool",
        };
      }
      case "tool_result": {
        const detail = event.isError ? truncate(contentToText(event.output)) : undefined;
        return {
          data: {
            id: event.toolId,
            isError: event.isError,
            name: event.toolName,
            phase: "result",
            ...(detail !== undefined && { detail }),
          },
          event: "tool",
        };
      }
      case "usage": {
        inputTokens += event.usage.inputTokens;
        outputTokens += event.usage.outputTokens;
        return undefined;
      }
      case "error": {
        outcome = "error";
        errorMessage = truncate(event.error.message);
        return {
          data: { code: ErrorCode.OperationError, message: errorMessage },
          event: "business-error",
        };
      }
      case "loop_complete": {
        if (event.stopReason === "end_turn") {
          outcome = "end_turn";
          return undefined;
        }
        if (event.stopReason === "interrupted") {
          outcome = "interrupted";
          return undefined;
        }
        outcome = "other";
        errorMessage = `Generation stopped: ${event.stopReason}`;
        return {
          data: { code: ErrorCode.OperationError, message: errorMessage },
          event: "business-error",
        };
      }
      default:
        return undefined;
    }
  };

  return {
    errorMessage: () => errorMessage,
    map,
    narration: () => narrationParts.join("").trim(),
    outcome: () => outcome,
    usage: () => ({ input: inputTokens, output: outputTokens }),
  };
};
