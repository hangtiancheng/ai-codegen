import { CodegenType } from "../generated/prisma/enums.js";
import { createViteLogSession, logWorkflowError } from "./vite-codegen-log-events.js";
import { operationErrorEvent, stepEvent } from "./workflow-event-factory.js";
import type { WorkflowSseEvent } from "./workflow-events.schema.js";
import { runCodegenAttempts } from "./workflow-codegen-attempts.js";
import { finalizeGeneratedProject } from "./workflow-project-finalizer.js";
import { createInitialWorkflowState, type WorkflowState } from "./workflow-state.schema.js";
import { createNoopViteCodegenLogger } from "./vite-codegen-logger.js";
import type {
  CodeGenerator,
  CodegenWorkflowDeps,
  ExecuteWorkflowInput,
  QualityChecker,
  WorkflowChatWriter,
} from "./workflow-types.js";

export const createCodegenWorkflow = (deps: CodegenWorkflowDeps) => {
  const maxAttempts = deps.maxAttempts ?? 2;
  const viteCodegenLogger = deps.viteCodegenLogger ?? createNoopViteCodegenLogger();

  async function* execute(input: ExecuteWorkflowInput): AsyncGenerator<WorkflowSseEvent> {
    let state: WorkflowState = createInitialWorkflowState(input);
    const viteLog =
      input.codegenType === CodegenType.VITE_PROJECT
        ? await createViteLogSession(viteCodegenLogger, input)
        : undefined;
    yield {
      data: {
        appId: input.appId.toString(),
        message: "Codegen workflow started",
      },
      event: "workflow-start",
    };
    await deps.chatWriter.writeUserMessage({
      appId: input.appId,
      message: input.userPrompt,
      userId: input.userId,
    });
    await viteLog?.info({
      message: "User message saved to chat history",
      stage: "chat-history",
    });
    yield stepEvent("chatHistory", 1);
    yield stepEvent("promptEnhance", 2);
    yield stepEvent("router", 3);

    try {
      state = yield* runCodegenAttempts({
        codeGenerator: deps.codeGenerator,
        maxAttempts,
        qualityChecker: deps.qualityChecker,
        state,
        ...(viteLog !== undefined && { viteLog }),
      });

      if (!state.qualityCheckPassed) {
        await viteLog?.info({
          details: { qualityCheckMessage: state.qualityCheckMessage },
          message: "Codegen workflow stopped because quality checks failed",
          stage: "error",
        });
        yield operationErrorEvent(state.qualityCheckMessage);
        return;
      }

      const finalized = await finalizeGeneratedProject({
        appId: input.appId,
        ...(deps.outputRootDir !== undefined && {
          outputRootDir: deps.outputRootDir,
        }),
        state,
        ...(viteLog !== undefined && { viteLog }),
      });
      state = finalized.state;
      for (const event of finalized.events) yield event;
      if (finalized.failed) return;

      await deps.chatWriter.writeAiMessage({
        appId: input.appId,
        message: state.generatedCode,
        userId: input.userId,
      });
      await viteLog?.info({
        message: "AI message saved to chat history",
        stage: "chat-history",
      });
      yield stepEvent("chatHistory", 12);
      await viteLog?.info({
        message: "Codegen workflow completed",
        stage: "complete",
      });
      yield { data: { outputDir: state.outputDir }, event: "done" };
    } catch (error) {
      if (viteLog !== undefined) await logWorkflowError(viteLog, error);
      yield operationErrorEvent("Codegen workflow failed unexpectedly");
    }
  }

  return { execute };
};

export type CodegenWorkflow = ReturnType<typeof createCodegenWorkflow>;
export type {
  CodeGenerator,
  CodegenStreamMetadata,
  CodegenWorkflowDeps,
  ExecuteWorkflowInput,
  QualityChecker,
  WorkflowChatWriter,
} from "./workflow-types.js";
