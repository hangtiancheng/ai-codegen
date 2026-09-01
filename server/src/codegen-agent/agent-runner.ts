import {
  Agent,
  type AgentEvent,
  type ConversationManager,
  createClient,
  FileStateCache,
  getContextWindow,
  getMaxOutputTokens,
  PermissionChecker,
  type ProviderConfig,
} from "@swifty.js/swifty";
import { createCodegenToolRegistry } from "./agent-tools.js";
import { renderSystemPrompt } from "./system-prompt.js";

export type RunCodegenAgentInput = Readonly<{
  abortSignal: AbortSignal;
  conversation: ConversationManager;
  maxIterations: number;
  providerConfig: ProviderConfig;
  systemPromptTemplate: string;
  workDir: string;
}>;

export const runCodegenAgent = async function* (
  input: RunCodegenAgentInput,
): AsyncGenerator<AgentEvent> {
  const client = await createClient(
    input.providerConfig,
    renderSystemPrompt(input.systemPromptTemplate, input.workDir),
  );
  const agent = new Agent({
    abortSignal: input.abortSignal,
    checker: new PermissionChecker(input.workDir, "bypassPermissions"),
    client,
    contextWindow: getContextWindow(input.providerConfig),
    conversation: input.conversation,
    fileStateCache: new FileStateCache(),
    maxIterations: input.maxIterations,
    maxOutput: getMaxOutputTokens(input.providerConfig),
    registry: createCodegenToolRegistry(),
    workDir: input.workDir,
  });
  yield* agent.run();
};
