import { parseGeneratedCode, saveGeneratedProject } from "../project/index.js";
import { stepEvent } from "./workflow-event-factory.js";
import type { WorkflowSseEvent } from "./workflow-events.schema.js";
import type { WorkflowState } from "./workflow-state.schema.js";

export type FinalizeGeneratedProjectInput = Readonly<{
  appId: bigint;
  outputRootDir?: string;
  state: WorkflowState;
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
  const saved = await saveGeneratedProject({
    appId: input.appId.toString(),
    codegenType: input.state.codegenType,
    parsedProject: parsed,
    ...(input.outputRootDir !== undefined && { rootDir: input.outputRootDir }),
  });
  const state: WorkflowState = { ...input.state, outputDir: saved.outputDir };
  events.push(stepEvent("saveProject", 10));
  return { events, failed: false, state };
};
