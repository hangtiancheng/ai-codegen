import { CodegenType } from "../generated/prisma/enums.js";
import { buildViteProject, parseGeneratedCode, saveGeneratedProject } from "../project/index.js";
import { operationErrorEvent, stepEvent } from "./workflow-event-factory.js";
import { logBuildCompleted, logParsedProject, logSavedProject } from "./vite-codegen-log-events.js";
import type { ViteCodegenLogSession } from "./vite-codegen-logger.js";
import type { WorkflowSseEvent } from "./workflow-events.schema.js";
import type { WorkflowState } from "./workflow-state.schema.js";

export type FinalizeGeneratedProjectInput = Readonly<{
  appId: bigint;
  outputRootDir?: string;
  state: WorkflowState;
  viteLog?: ViteCodegenLogSession;
}>;

export type FinalizeGeneratedProjectResult = Readonly<{
  events: readonly WorkflowSseEvent[];
  failed: boolean;
  state: WorkflowState;
}>;

export const finalizeGeneratedProject = async (
  input: FinalizeGeneratedProjectInput,
): Promise<FinalizeGeneratedProjectResult> => {
  const events: WorkflowSseEvent[] = [];
  const parsed = parseGeneratedCode(input.state.generatedCode, input.state.codegenType);
  if (input.viteLog !== undefined) await logParsedProject(input.viteLog, parsed);
  const saved = await saveGeneratedProject({
    appId: input.appId.toString(),
    codegenType: input.state.codegenType,
    parsedProject: parsed,
    ...(input.outputRootDir !== undefined && { rootDir: input.outputRootDir }),
  });
  let state: WorkflowState = { ...input.state, outputDir: saved.outputDir };
  if (input.viteLog !== undefined) await logSavedProject(input.viteLog, saved);
  events.push(stepEvent("saveProject", 10));

  if (state.codegenType !== CodegenType.VITE_PROJECT) {
    return { events, failed: false, state };
  }

  await input.viteLog?.info({ message: "Vite project build started", stage: "project-build" });
  const build = await buildViteProject(saved.outputDir);
  state = { ...state, buildLogs: build.logs, buildSuccess: build.success };
  if (input.viteLog !== undefined) await logBuildCompleted(input.viteLog, build);
  events.push(stepEvent("projectBuild", 11));
  if (build.success) return { events, failed: false, state };

  await input.viteLog?.info({
    message: "Codegen workflow stopped because project build failed",
    stage: "error",
  });
  events.push(operationErrorEvent("Project build failed"));
  return { events, failed: true, state };
};
