import { ErrorCode } from "../common/index";
import type { WorkflowSseEvent, WorkflowStep } from "./workflow-events.schema";

export const stepEvent = (step: WorkflowStep, stepNumber: number): WorkflowSseEvent => ({
  data: { step, stepNumber },
  event: "step-complete",
});

export const chunkEvent = (chunk: string): WorkflowSseEvent => ({
  data: { d: chunk },
  event: "chunk",
});

export const operationErrorEvent = (message: string): WorkflowSseEvent => ({
  data: {
    code: ErrorCode.OperationError,
    message,
  },
  event: "business-error",
});
