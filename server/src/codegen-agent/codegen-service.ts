import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProviderConfig } from "@swifty.js/swifty";
import type { ChatHistoryService } from "../chat-history/index.js";
import { ErrorCode } from "../common/index.js";
import { ChatMessageType } from "../generated/prisma/enums.js";
import type { MetricsService } from "../observability/index.js";
import { buildCodeOutputDir } from "../project/index.js";
import { createAgentEventCollector } from "./agent-event-mapper.js";
import { runCodegenAgent } from "./agent-runner.js";
import type { CodegenSseEvent } from "./codegen-events.schema.js";
import { buildConversation } from "./conversation-builder.js";
import { listGeneratedFiles } from "./file-manifest.js";

const REQUIRED_PROJECT_FILES = ["package.json", "index.html"] as const;
const HISTORY_REPLAY_PAGE_SIZE = 20;
const MODEL_ROLE = "agent";

export type CodegenServiceDeps = Readonly<{
  chatHistoryService: ChatHistoryService;
  maxIterations: number;
  metricsService: MetricsService;
  outputRootDir?: string;
  providerConfig: ProviderConfig;
  systemPromptTemplate: string;
}>;

export type ExecuteCodegenInput = Readonly<{
  abortSignal: AbortSignal;
  appId: bigint;
  userId: bigint;
  userPrompt: string;
}>;

export type CodegenService = Readonly<{
  execute: (input: ExecuteCodegenInput) => AsyncGenerator<CodegenSseEvent>;
}>;

const businessError = (message: string): CodegenSseEvent => ({
  data: { code: ErrorCode.OperationError, message },
  event: "business-error",
});

const buildAiMessage = (narration: string, files: readonly string[]): string => {
  const summary = narration.length > 0 ? narration : "Generation finished.";
  if (files.length === 0) return summary;
  return `${summary}\n\n---\nGenerated files:\n${files.map((file) => `- ${file}`).join("\n")}`;
};

export const createCodegenService = (deps: CodegenServiceDeps): CodegenService => {
  const rootDir = deps.outputRootDir ?? process.cwd();

  const writeAiMessage = async (input: ExecuteCodegenInput, message: string): Promise<void> => {
    if (message.trim().length === 0) return;
    await deps.chatHistoryService.addMessage({
      appId: input.appId,
      message,
      messageType: ChatMessageType.AI,
      userId: input.userId,
    });
  };

  const execute = async function* (input: ExecuteCodegenInput): AsyncGenerator<CodegenSseEvent> {
    const workDir = buildCodeOutputDir(rootDir, input.appId.toString());
    await mkdir(workDir, { recursive: true });

    // Read history before persisting this turn's prompt so the replay does not
    // duplicate it — buildConversation appends the prompt itself.
    const history = await deps.chatHistoryService.listByAppCursor(input.appId, {
      pageSize: HISTORY_REPLAY_PAGE_SIZE,
    });
    await deps.chatHistoryService.addMessage({
      appId: input.appId,
      message: input.userPrompt,
      messageType: ChatMessageType.USER,
      userId: input.userId,
    });

    const collector = createAgentEventCollector();
    try {
      const events = runCodegenAgent({
        abortSignal: input.abortSignal,
        conversation: buildConversation(history, input.userPrompt),
        maxIterations: deps.maxIterations,
        providerConfig: deps.providerConfig,
        systemPromptTemplate: deps.systemPromptTemplate,
        workDir,
      });
      for await (const event of events) {
        const sseEvent = collector.map(event);
        if (sseEvent !== undefined) yield sseEvent;
        if (event.type === "error") break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Code generation failed";
      yield businessError(message);
      await writeAiMessage(input, `${collector.narration()}\n\n_Failed: ${message}_`);
      return;
    } finally {
      const usage = collector.usage();
      deps.metricsService.recordAiTokenUsage({
        modelRole: MODEL_ROLE,
        tokenType: "input",
        tokens: usage.input,
      });
      deps.metricsService.recordAiTokenUsage({
        modelRole: MODEL_ROLE,
        tokenType: "output",
        tokens: usage.output,
      });
    }

    const narration = collector.narration();
    const outcome = collector.outcome();

    if (outcome === "interrupted") {
      await writeAiMessage(input, `${narration}\n\n_Interrupted._`);
      return;
    }

    if (outcome !== "end_turn") {
      await writeAiMessage(
        input,
        `${narration}\n\n_Failed: ${collector.errorMessage() ?? "unknown error"}_`,
      );
      return;
    }

    const files = await listGeneratedFiles(workDir);
    const missingFiles = REQUIRED_PROJECT_FILES.filter((file) => !existsSync(join(workDir, file)));
    if (missingFiles.length > 0) {
      const message = `The agent did not produce: ${missingFiles.join(", ")}`;
      yield businessError(message);
      await writeAiMessage(input, `${narration}\n\n_Failed: ${message}_`);
      return;
    }

    await writeAiMessage(input, buildAiMessage(narration, files));
    yield { data: {}, event: "done" };
  };

  return { execute };
};
