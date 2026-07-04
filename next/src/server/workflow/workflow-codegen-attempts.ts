import {
  logGeneratedCode,
  logPartialGeneratedCode,
  logQualityCheck,
} from "./vite-codegen-log-events";
import type { ViteCodegenLogSession } from "./vite-codegen-logger";
import { chunkEvent, stepEvent } from "./workflow-event-factory";
import type { WorkflowSseEvent } from "./workflow-events.schema";
import type { WorkflowState } from "./workflow-state.schema";
import type { CodeGenerator, CodegenStreamMetadata, QualityChecker } from "./workflow-types";

export type RunCodegenAttemptsInput = Readonly<{
  codeGenerator: CodeGenerator;
  maxAttempts: number;
  qualityChecker: QualityChecker;
  state: WorkflowState;
  viteLog?: ViteCodegenLogSession;
}>;

export async function* runCodegenAttempts(
  input: RunCodegenAttemptsInput,
): AsyncGenerator<WorkflowSseEvent, WorkflowState> {
  let state = input.state;
  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    let generatedCode = "";
    let finalMetadata: CodegenStreamMetadata | undefined;
    await input.viteLog?.info({
      attempt,
      message: "Streaming code generation started",
      stage: "codegen",
    });
    try {
      for await (const chunk of input.codeGenerator.streamCode({
        codegenType: state.codegenType,
        prompt: state.enhancedPrompt,
      })) {
        if (chunk.metadata !== undefined) finalMetadata = chunk.metadata;
        if (chunk.content.length === 0) continue;
        generatedCode += chunk.content;
        yield chunkEvent(chunk.content);
      }
    } catch (error) {
      if (input.viteLog !== undefined) {
        await logPartialGeneratedCode(input.viteLog, attempt, generatedCode, error);
      }
      throw error;
    }
    if (input.viteLog !== undefined) {
      await logGeneratedCode(input.viteLog, attempt, generatedCode, finalMetadata);
    }
    state = { ...state, generatedCode };
    yield stepEvent("codegen", 4 + (attempt - 1) * 2);

    const quality = await input.qualityChecker.check({
      code: generatedCode,
      codegenType: state.codegenType,
    });
    state = {
      ...state,
      qualityCheckMessage: quality.message,
      qualityCheckPassed: quality.passed,
    };
    if (input.viteLog !== undefined) {
      await logQualityCheck(input.viteLog, attempt, quality.message, quality.passed);
    }
    yield stepEvent("qualityCheck", 5 + (attempt - 1) * 2);
    if (quality.passed) break;
  }
  return state;
}
