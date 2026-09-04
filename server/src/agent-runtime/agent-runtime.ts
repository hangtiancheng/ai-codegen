import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import {
  Agent,
  type AgentEvent,
  type Asker,
  buildSkillSection,
  contentToText,
  coordinatorActive,
  coordinatorToolFilter,
  createRemoteAgent,
  type Decision,
  forceCompact,
  getMaxOutputTokens,
  MemoryConsolidator,
  MemoryExtractor,
  type Message,
  PermissionChecker,
  type PermissionMode,
  type Question,
  type RemoteAgentHandle,
  runInline,
  type ThinkingBlock,
  type ToolResultBlock,
  type ToolUseBlock,
} from "@swifty.js/swifty";
import { env } from "../config/index.js";
import type { AgentPermissionMode, AgentSessionStatus } from "../generated/prisma/enums.js";
import type { AgentTranscriptEventModel } from "../generated/prisma/models/AgentTranscriptEvent.js";
import type { AgentWorkspaceModel } from "../generated/prisma/models/AgentWorkspace.js";
import type { MetricsService } from "../observability/index.js";
import {
  buildCommandCandidates,
  type CommandCandidate,
  parseCommand,
  SERVER_SUPPORTED_COMMANDS,
} from "./command-dispatcher.js";
import { createEventAdapter } from "./event-adapter.js";
import type { GitRuntime } from "./git-runtime.js";
import { buildHookConfigs } from "./hook-runtime.js";
import {
  createInteractionBroker,
  type InteractionBroker,
  toPermissionPayload,
} from "./interaction-broker.js";
import { toSwiftyMcpConfig } from "./mcp-config.js";
import type { AgentServerMessage, AgentTranscriptEventMessage } from "./protocol.js";
import { buildProviderConfig } from "./provider.js";
import type { AgentStores } from "./stores.js";
import type { AgentConnection, PermissionDecision, QuestionAnswers } from "./types.js";
import { AsyncLock } from "./workspace-lock.js";

const REPLAY_LIMIT = 200;
const BACKLOG_BATCH_SIZE = 1_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMessageContent = (value: unknown): value is Message["content"] =>
  typeof value === "string" || (Array.isArray(value) && value.every((item) => isRecord(item)));

const isThinkingBlock = (value: unknown): value is ThinkingBlock =>
  isRecord(value) && typeof value.thinking === "string" && typeof value.signature === "string";

const isToolUseBlock = (value: unknown): value is ToolUseBlock =>
  isRecord(value) &&
  typeof value.toolUseId === "string" &&
  typeof value.toolName === "string" &&
  isRecord(value.arguments);

const isToolResultBlock = (value: unknown): value is ToolResultBlock =>
  isRecord(value) &&
  typeof value.toolUseId === "string" &&
  isMessageContent(value.content) &&
  typeof value.isError === "boolean";

const isMessage = (value: unknown): value is Message => {
  if (
    !isRecord(value) ||
    (value.role !== "user" && value.role !== "assistant" && value.role !== "system") ||
    !isMessageContent(value.content) ||
    (value.role !== "user" && typeof value.content !== "string")
  ) {
    return false;
  }
  if (
    value.thinkingBlocks !== undefined &&
    (!Array.isArray(value.thinkingBlocks) || !value.thinkingBlocks.every(isThinkingBlock))
  ) {
    return false;
  }
  if (
    value.toolUses !== undefined &&
    (!Array.isArray(value.toolUses) || !value.toolUses.every(isToolUseBlock))
  ) {
    return false;
  }
  return (
    value.toolResults === undefined ||
    (Array.isArray(value.toolResults) && value.toolResults.every(isToolResultBlock))
  );
};

export const parseSavedConversationMessages = (context: unknown): Message[] | null => {
  if (!isRecord(context) || !Array.isArray(context.messages)) return null;
  return context.messages.every(isMessage) ? context.messages : null;
};

const parseSavedActiveSkills = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];

const toSwiftyMode = (mode: AgentPermissionMode): PermissionMode => {
  switch (mode) {
    case "DEFAULT":
      return "default";
    case "ACCEPT_EDITS":
      return "acceptEdits";
    case "PLAN":
      return "plan";
    default:
      return "bypassPermissions";
  }
};

export type RunTurnInput = Readonly<{
  requestId: string;
  turnId: string;
  input: string;
  selectedElement?: Record<string, unknown>;
  previewError?: string;
}>;

export type AgentRuntimeDeps = Readonly<{
  workspace: AgentWorkspaceModel;
  appId: bigint;
  workDir: string;
  stores: AgentStores;
  git: GitRuntime;
  metrics: MetricsService;
}>;

const toEventMessage = (row: AgentTranscriptEventModel): AgentTranscriptEventMessage => ({
  createdAt: row.createTime.toISOString(),
  kind: row.kind,
  payload: row.payload,
  sequence: row.sequence.toString(),
  sessionId: row.sessionId,
  ...(row.turnId !== null && { turnId: row.turnId }),
});

/**
 * A long-lived, per-app agent runtime. One instance owns the Swifty agent stack
 * (via createRemoteAgent), the canonical DB session, the transcript sequence
 * counter, and the set of connected subscribers. Turns are serialized through an
 * internal lock and each turn constructs a fresh Agent with a permission checker
 * reflecting the workspace's current mode (default: bypassPermissions).
 */
export class AgentRuntime {
  readonly appId: bigint;
  readonly workspaceId: bigint;
  private readonly workDir: string;
  private readonly stores: AgentStores;
  private readonly git: GitRuntime;
  private readonly metrics: MetricsService;
  private readonly broker: InteractionBroker;
  private readonly lock = new AsyncLock();
  private readonly connections = new Set<AgentConnection>();

  private workspace: AgentWorkspaceModel;
  private handlePromise: Promise<RemoteAgentHandle> | undefined;
  private sessionPromise: Promise<string> | undefined;
  private disposePromise: Promise<void> | undefined;
  private sessionId = "";
  private sequence = 0n;
  private currentAbort: AbortController | undefined;
  private currentTurnId: string | null = null;
  private lastActivityMs = Date.now();
  private activeTaskCount = 0;
  private disposing = false;

  constructor(deps: AgentRuntimeDeps) {
    this.appId = deps.appId;
    this.workspaceId = deps.workspace.id;
    this.workspace = deps.workspace;
    this.workDir = deps.workDir;
    this.stores = deps.stores;
    this.git = deps.git;
    this.metrics = deps.metrics;
    this.broker = createInteractionBroker(deps.stores);
  }

  get lastActivity(): number {
    return this.lastActivityMs;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  get isBusy(): boolean {
    return this.activeTaskCount > 0 || this.currentTurnId !== null || this.broker.hasPending();
  }

  private markActivity(): void {
    this.lastActivityMs = Date.now();
  }

  private assertAcceptingTasks(): void {
    if (this.disposing) throw new Error("Agent runtime is disposing");
  }

  private runLockedTask<T>(task: () => Promise<T>): Promise<T> {
    this.assertAcceptingTasks();
    this.activeTaskCount += 1;
    const result = this.lock.run(async () => {
      this.assertAcceptingTasks();
      return task();
    });
    return result.finally(() => {
      this.activeTaskCount -= 1;
    });
  }

  private broadcast(message: AgentServerMessage): void {
    for (const connection of this.connections) {
      try {
        connection.send(message);
      } catch {
        /* a broken socket is dropped on its own close handler */
      }
    }
  }

  private ensureSession(): Promise<string> {
    this.assertAcceptingTasks();
    if (this.sessionId.length > 0) return Promise.resolve(this.sessionId);
    if (this.sessionPromise !== undefined) return this.sessionPromise;
    const sessionPromise = this.initializeSession();
    this.sessionPromise = sessionPromise;
    void sessionPromise.catch(() => {
      if (this.sessionPromise === sessionPromise) this.sessionPromise = undefined;
    });
    return sessionPromise;
  }

  private async initializeSession(): Promise<string> {
    const currentId = this.workspace.currentSessionId;
    if (currentId !== null) {
      const existing = await this.stores.sessions.findById(currentId);
      if (existing !== null) {
        // A fresh process has no Promise waiting for persisted PENDING rows. Only
        // cancel those stale rows here; live broker entries are never consulted.
        await this.stores.interactions.cancelPending(existing.id);
        if (existing.status !== "COMPLETED" && existing.status !== "ABORTED") {
          if (existing.status !== "IDLE") {
            await this.stores.sessions.updateStatus(existing.id, "IDLE");
          }
          this.sessionId = existing.id;
          this.sequence = existing.lastEventSequence;
          return this.sessionId;
        }
      }
    }
    const session = await this.stores.sessions.createAndSetCurrent(this.workspaceId);
    this.workspace = { ...this.workspace, currentSessionId: session.id };
    this.sessionId = session.id;
    this.sequence = session.lastEventSequence;
    return this.sessionId;
  }

  private async ensureHandle(): Promise<RemoteAgentHandle> {
    this.assertAcceptingTasks();
    if (this.handlePromise !== undefined) return this.handlePromise;
    this.handlePromise = this.createHandle().catch((error: unknown) => {
      this.handlePromise = undefined;
      throw error;
    });
    return this.handlePromise;
  }

  private async createHandle(): Promise<RemoteAgentHandle> {
    await mkdir(this.workDir, { recursive: true });
    const [mcpRows, hookRows] = await Promise.all([
      this.stores.mcp.listEnabled(this.workspaceId),
      this.workspace.hooksEnabled
        ? this.stores.hooks.listEnabled(this.workspaceId)
        : Promise.resolve([]),
    ]);
    const provider = buildProviderConfig(env, this.workspace.modelOverride);
    const handle = await createRemoteAgent({
      askUser: this.askUser,
      enableCoordinatorMode: false,
      forkDisabled: false,
      hooks: buildHookConfigs(hookRows),
      mcpServers: mcpRows.map(toSwiftyMcpConfig),
      provider,
      workDir: this.workDir,
    });
    await this.rehydrate(handle);
    return handle;
  }

  private async rehydrate(handle: RemoteAgentHandle): Promise<void> {
    const sessionId = await this.ensureSession();
    const session = await this.stores.sessions.findById(sessionId);
    const savedMessages = parseSavedConversationMessages(session?.context);

    if (savedMessages !== null && savedMessages.length > 0) {
      for (const message of savedMessages) {
        if (message.role === "user") {
          if (message.toolResults !== undefined && message.toolResults.length > 0) {
            handle.conv.addToolResultsMessage(message.toolResults);
          } else {
            handle.conv.addUserMessage(message.content);
          }
        } else if (message.role === "assistant" && typeof message.content === "string") {
          if (message.thinkingBlocks !== undefined || message.toolUses !== undefined) {
            handle.conv.addAssistantFull(
              message.content,
              message.thinkingBlocks ?? [],
              message.toolUses ?? [],
            );
          } else {
            handle.conv.addAssistantMessage(message.content);
          }
        } else if (typeof message.content === "string") {
          handle.conv.addSystemReminder(message.content);
        }
      }
    } else {
      const rows = await this.stores.transcript.listRecent(sessionId, REPLAY_LIMIT);
      for (const row of rows) {
        const payload = row.payload as { text?: unknown } | null;
        const text = payload !== null && typeof payload.text === "string" ? payload.text : "";
        if (text.length === 0) continue;
        if (row.kind === "user_message") handle.conv.addUserMessage(text);
        else if (row.kind === "assistant_message") handle.conv.addAssistantMessage(text);
      }
    }

    if (handle.skillCatalog !== null) {
      for (const name of parseSavedActiveSkills(session?.activeSkills)) {
        const skill = handle.skillCatalog.get(name);
        if (skill !== undefined) handle.activeSkills.set(name, skill.body);
      }
    }
  }

  private readonly askUser: Asker = async (questions: Question[]) => {
    this.assertAcceptingTasks();
    const sessionId = this.sessionId;
    const { answers, interactionId } = await this.broker.requestQuestions({
      questions,
      sessionId,
      turnId: this.currentTurnId,
    });
    this.broadcast({
      interactionId,
      questions,
      sessionId,
      type: "question_request",
      ...(this.currentTurnId !== null && { turnId: this.currentTurnId }),
    });
    this.broadcast({ status: "waiting", type: "runtime_status", sessionId });
    try {
      return await answers;
    } finally {
      this.broadcast({ status: "running", type: "runtime_status", sessionId });
    }
  };

  private buildPermissionCallback(checker: PermissionChecker, turnId: string) {
    return async (
      toolName: string,
      args: Record<string, unknown>,
      decision: Decision,
    ): Promise<PermissionDecision> => {
      if (this.disposing) return "deny";
      const description = checker.describeToolAction(toolName, args);
      const { decision: pending, interactionId } = await this.broker.requestPermission({
        payload: toPermissionPayload(toolName, args, decision, description),
        sessionId: this.sessionId,
        turnId,
      });
      this.broadcast({
        interactionId,
        request: { args, description, reason: decision.reason, toolName },
        sessionId: this.sessionId,
        turnId,
        type: "permission_request",
      });
      this.broadcast({
        sessionId: this.sessionId,
        status: "waiting",
        turnId,
        type: "runtime_status",
      });
      try {
        return await pending;
      } finally {
        this.broadcast({
          sessionId: this.sessionId,
          status: "running",
          turnId,
          type: "runtime_status",
        });
      }
    };
  }

  private async emitPersist(
    turnId: string | null,
    kind: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const row = await this.stores.transcript.appendNext({
      kind,
      payload,
      sessionId: this.sessionId,
      turnId,
    });
    if (row.sequence > this.sequence) this.sequence = row.sequence;
    this.broadcast({ event: toEventMessage(row), type: "event" });
  }

  private async setStatus(status: AgentSessionStatus, completed = false): Promise<void> {
    await this.stores.sessions.updateStatus(this.sessionId, status, completed);
  }

  addConnection(connection: AgentConnection): void {
    this.markActivity();
    this.connections.add(connection);
  }

  removeConnection(connection: AgentConnection): void {
    this.connections.delete(connection);
  }

  touch(): void {
    this.markActivity();
  }

  /** Runs a task under the same lock as agent turns (used by file mutations). */
  async runExclusive<T>(task: (workDir: string) => Promise<T>): Promise<T> {
    this.markActivity();
    return this.runLockedTask(() => task(this.workDir));
  }

  notifyFilesChanged(paths: readonly string[]): void {
    this.broadcast({ paths: [...paths], type: "files_changed" });
  }

  private async currentHighWatermark(sessionId: string): Promise<bigint> {
    const persisted = await this.stores.sessions.findById(sessionId);
    const highWatermark =
      persisted !== null && persisted !== undefined && persisted.lastEventSequence > this.sequence
        ? persisted.lastEventSequence
        : this.sequence;
    this.sequence = highWatermark;
    return highWatermark;
  }

  async ready(connection: AgentConnection): Promise<void> {
    const sessionId = await this.ensureSession();
    const highWatermark = await this.currentHighWatermark(sessionId);
    const pendingInteractions = this.broker.snapshot(sessionId);
    connection.send({
      currentTurnId: this.currentTurnId,
      highWatermark: highWatermark.toString(),
      pendingInteractions,
      permissionMode: this.workspace.permissionMode,
      readOnly: connection.readOnly,
      runtimeStatus:
        this.currentTurnId === null
          ? "idle"
          : pendingInteractions.length > 0
            ? "waiting"
            : "running",
      sessionId,
      type: "ready",
    });
  }

  async sendBacklog(connection: AgentConnection, afterSequence: bigint): Promise<void> {
    const sessionId = await this.ensureSession();
    const highWatermark = await this.currentHighWatermark(sessionId);
    let cursor = afterSequence;

    while (true) {
      const rows = await this.stores.transcript.listAfter(
        sessionId,
        cursor,
        highWatermark,
        BACKLOG_BATCH_SIZE,
      );
      const nextCursor = rows.at(-1)?.sequence ?? cursor;
      const complete = rows.length === 0 || nextCursor >= highWatermark;
      connection.send({
        complete,
        events: rows.map(toEventMessage),
        highWatermark: highWatermark.toString(),
        sessionId,
        type: "transcript_batch",
      });
      if (complete) return;
      cursor = nextCursor;
    }
  }

  applySoftSettings(patch: {
    permissionMode?: AgentPermissionMode;
    sandboxEnabled?: boolean;
    memoryEnabled?: boolean;
  }): void {
    this.workspace = {
      ...this.workspace,
      ...(patch.permissionMode !== undefined && { permissionMode: patch.permissionMode }),
      ...(patch.sandboxEnabled !== undefined && { sandboxEnabled: patch.sandboxEnabled }),
      ...(patch.memoryEnabled !== undefined && { memoryEnabled: patch.memoryEnabled }),
    };
    this.broadcast({
      sessionId: this.sessionId,
      status: "idle",
      type: "runtime_status",
      detail: `permissionMode=${this.workspace.permissionMode}`,
    });
  }

  abort(): void {
    this.currentAbort?.abort();
  }

  async runTurn(input: RunTurnInput): Promise<void> {
    await this.runLockedTask(async () => {
      this.markActivity();
      const handle = await this.ensureHandle();
      const sessionId = await this.ensureSession();
      this.currentTurnId = input.turnId;
      const abort = new AbortController();
      this.currentAbort = abort;

      try {
        await this.emitPersist(input.turnId, "user_message", {
          text: input.input,
          ...(input.selectedElement !== undefined && { selectedElement: input.selectedElement }),
          ...(input.previewError !== undefined && { previewError: input.previewError }),
        });
        await this.setStatus("RUNNING");
        this.broadcast({
          sessionId,
          status: "running",
          turnId: input.turnId,
          type: "runtime_status",
        });

        const adapter = createEventAdapter();
        const checker = new PermissionChecker(
          this.workDir,
          toSwiftyMode(this.workspace.permissionMode),
        );
        checker.sandboxEnabled = this.workspace.sandboxEnabled;

        handle.conv.addUserMessage(this.composePrompt(input));
        const skillSection =
          handle.skillCatalog !== null ? buildSkillSection(handle.skillCatalog, this.workDir) : "";

        const agent = new Agent({
          abortSignal: abort.signal,
          activeSkills: handle.activeSkills,
          checker,
          client: handle.client,
          contextWindow: handle.contextWindow,
          conversation: handle.conv,
          coordinatorActiveFn: () => coordinatorActive(false),
          fileHistory: handle.fileHistory,
          fileStateCache: handle.fileStateCache,
          instructions: handle.longTermMemoryInstructions,
          maxIterations: env.AI_MAX_ITERATIONS,
          maxOutput: getMaxOutputTokens(handle.provider),
          memoryContent: this.workspace.memoryEnabled ? handle.longTermMemoryMemoryContent : "",
          notificationFn: () => handle.teamManager.drainLeads(),
          onPermissionRequest: this.buildPermissionCallback(checker, input.turnId),
          recoveryState: handle.recoveryState,
          registry: handle.registry,
          // Session persistence is DB-only: passing an empty sessionId disables
          // Swifty's own JSONL session writes so the DB transcript is authoritative.
          sessionId: "",
          skillSection,
          workDir: this.workDir,
          toolFilter: (name: string) =>
            coordinatorToolFilter(false)(name) &&
            (handle.toolFilter !== null ? handle.toolFilter(name) : true),
          ...(this.workspace.hooksEnabled &&
            handle.hookEngine !== null && { hookEngine: handle.hookEngine }),
          ...(this.workspace.memoryEnabled && {
            onLoopComplete: (conv) => this.runMemoryMaintenance(handle, conv),
          }),
        });

        try {
          for await (const event of agent.run()) {
            await this.dispatchEvent(input.turnId, adapter, event);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Agent run failed";
          await this.emitPersist(input.turnId, "error", { message });
          this.broadcast({
            code: "agent_error",
            message,
            recoverable: true,
            requestId: input.requestId,
            type: "error",
          });
        }

        await this.finalizeTurn(handle, input, adapter);
      } finally {
        this.currentAbort = undefined;
        this.currentTurnId = null;
      }
    });
  }

  private composePrompt(input: RunTurnInput): string {
    let text = input.input;
    if (input.selectedElement !== undefined) {
      text += `\n\n<selected-element>\n${JSON.stringify(input.selectedElement)}\n</selected-element>`;
    }
    if (input.previewError !== undefined && input.previewError.length > 0) {
      text += `\n\n<preview-error>\n${input.previewError}\n</preview-error>`;
    }
    return text;
  }

  private async dispatchEvent(
    turnId: string,
    adapter: ReturnType<typeof createEventAdapter>,
    event: AgentEvent,
  ): Promise<void> {
    for (const output of adapter.mapEvent(event)) {
      if (output.persist) {
        await this.emitPersist(turnId, output.kind, output.payload);
      } else {
        this.broadcast(output.message);
      }
    }
  }

  private runMemoryMaintenance(handle: RemoteAgentHandle, conv: RemoteAgentHandle["conv"]): void {
    const summary = conv
      .getMessages()
      .slice(-40)
      .map((message) => `[${message.role}]: ${contentToText(message.content)}`)
      .filter((line) => line.length > 12)
      .join("\n");
    new MemoryExtractor(handle.client, this.workDir).extract(summary).catch(() => {
      /* non-fatal */
    });
    new MemoryConsolidator(handle.client, this.workDir, {
      appendSystem: (message) => conv.addSystemReminder(message),
    })
      .maybeRun()
      .catch(() => {
        /* non-fatal */
      });
  }

  private async finalizeTurn(
    handle: RemoteAgentHandle,
    input: RunTurnInput,
    adapter: ReturnType<typeof createEventAdapter>,
  ): Promise<void> {
    const narration = adapter.narration();
    if (narration.length > 0) {
      await this.emitPersist(input.turnId, "assistant_message", { text: narration });
    }

    const usage = adapter.usage();
    this.metrics.recordAiTokenUsage({
      modelRole: "agent",
      tokenType: "input",
      tokens: usage.input,
    });
    this.metrics.recordAiTokenUsage({
      modelRole: "agent",
      tokenType: "output",
      tokens: usage.output,
    });

    const outcome = adapter.outcome();
    if (outcome === "end_turn") {
      const sha = await this.git.snapshot(this.workDir, `agent: ${input.turnId}`);
      this.broadcast({
        paths: [],
        type: "files_changed",
        ...(sha !== undefined && { revision: sha }),
      });
    }

    try {
      await this.stores.sessions.saveContext(this.sessionId, {
        activeSkills: [...handle.activeSkills.keys()],
        context: { messages: handle.conv.getMessages() },
        runtimeMetadata: { lastOutcome: outcome, lastTurnId: input.turnId },
      });
    } catch {
      /* snapshot persistence is best-effort */
    }

    await this.setStatus("IDLE");
    this.broadcast({ sessionId: this.sessionId, status: "idle", type: "runtime_status" });
  }

  dispose(): Promise<void> {
    if (this.disposePromise !== undefined) return this.disposePromise;
    this.disposing = true;
    this.disposePromise = this.disposeResources();
    return this.disposePromise;
  }

  private async disposeResources(): Promise<void> {
    this.currentAbort?.abort();
    const sessionAtAbort = this.sessionId;
    if (sessionAtAbort.length > 0) {
      await this.broker.cancelSession(sessionAtAbort).catch(() => undefined);
    }

    // Disposal is never called from inside the workspace lock: doing so would
    // wait on the task that invoked it. Admission is already closed above.
    await this.lock.drain();

    await this.sessionPromise?.catch(() => undefined);
    if (this.sessionId.length > 0) {
      await this.broker.cancelSession(this.sessionId).catch(() => undefined);
    }

    if (this.handlePromise !== undefined) {
      const handle = await this.handlePromise.catch(() => undefined);
      if (handle !== undefined) {
        await handle.mcpManager?.disconnectAll().catch(() => undefined);
        await handle.hookEngine?.fire("shutdown", { event: "shutdown" }).catch(() => undefined);
        try {
          handle.fileHistory.save();
        } catch {
          /* best-effort */
        }
      }
    }
    for (const connection of this.connections) {
      try {
        connection.close(1001, "runtime disposed");
      } catch {
        /* continue closing remaining sockets */
      }
    }
    this.connections.clear();
  }

  async resolvePermission(interactionId: string, decision: PermissionDecision): Promise<boolean> {
    this.markActivity();
    const pending = this.broker
      .snapshot(this.sessionId)
      .find((interaction) => interaction.interactionId === interactionId);
    const resolved = await this.broker.resolvePermission(interactionId, decision);
    if (resolved && pending !== undefined) {
      this.broadcast({
        interactionId,
        outcome: decision === "deny" ? "denied" : "allowed",
        sessionId: pending.sessionId,
        type: "interaction_resolved",
      });
    }
    return resolved;
  }

  async resolveQuestion(interactionId: string, answers: QuestionAnswers): Promise<boolean> {
    this.markActivity();
    const pending = this.broker
      .snapshot(this.sessionId)
      .find((interaction) => interaction.interactionId === interactionId);
    const resolved = await this.broker.resolveQuestion(interactionId, answers);
    if (resolved && pending !== undefined) {
      this.broadcast({
        interactionId,
        outcome: "answered",
        sessionId: pending.sessionId,
        type: "interaction_resolved",
      });
    }
    return resolved;
  }

  getCommandCandidates(): CommandCandidate[] {
    return buildCommandCandidates(this.workDir);
  }

  private async startNewSession(): Promise<string> {
    const session = await this.stores.sessions.createAndSetCurrent(this.workspaceId);
    this.workspace = { ...this.workspace, currentSessionId: session.id };
    this.sessionId = session.id;
    this.sequence = session.lastEventSequence;
    this.sessionPromise = Promise.resolve(session.id);
    return session.id;
  }

  private sendCommandResult(
    requestId: string,
    command: string,
    supported: boolean,
    detail: { result?: unknown; error?: string },
  ): void {
    this.broadcast({
      command,
      requestId,
      supported,
      type: "command_result",
      ...(detail.result !== undefined && { result: detail.result }),
      ...(detail.error !== undefined && { error: detail.error }),
    });
  }

  /**
   * Handles a slash command entered via a `run` message. Reliably supported
   * commands run against the in-process stack; `/skill` is rewritten into a
   * normal agent turn; everything else returns an explicit unsupported result.
   */
  async handleCommand(input: string, requestId: string): Promise<void> {
    const parsed = parseCommand(input);
    if (parsed === null) {
      this.sendCommandResult(requestId, input, false, { error: "Not a command" });
      return;
    }
    const { args, name } = parsed;
    if (!SERVER_SUPPORTED_COMMANDS.has(name)) {
      this.sendCommandResult(requestId, name, false, {
        error: `Command /${name} is not supported by the server runtime`,
      });
      return;
    }

    if (name === "help") {
      this.sendCommandResult(requestId, name, true, { result: this.getCommandCandidates() });
      return;
    }

    const handle = await this.ensureHandle();

    if (name === "skill") {
      await this.runSkillCommand(handle, args, requestId);
      return;
    }
    if (name === "skills") {
      if (args.trim() === "reload") handle.skillCatalog?.reload();
      this.sendCommandResult(requestId, name, true, {
        result: handle.skillCatalog?.list() ?? [],
      });
      return;
    }
    if (name === "memory") {
      this.sendCommandResult(requestId, name, true, {
        result: handle.memoryManager.loadAll().map((file) => ({
          description: file.description,
          name: file.name,
          type: file.type,
        })),
      });
      return;
    }
    if (name === "mcp") {
      this.sendCommandResult(requestId, name, true, {
        result: { connected: handle.mcpManager?.connectedServers() ?? [] },
      });
      return;
    }
    if (name === "status") {
      this.sendCommandResult(requestId, name, true, {
        result: {
          contextWindow: handle.contextWindow,
          permissionMode: this.workspace.permissionMode,
          sessionId: this.sessionId,
          toolCount: handle.registry.listTools().length,
        },
      });
      return;
    }
    if (name === "clear") {
      await this.runLockedTask(async () => {
        handle.conv.reset();
        await this.startNewSession();
      });
      this.sendCommandResult(requestId, name, true, { result: { sessionId: this.sessionId } });
      for (const connection of this.connections) {
        await this.ready(connection);
      }
      this.broadcast({ sessionId: this.sessionId, status: "idle", type: "runtime_status" });
      return;
    }
    if (name === "compact") {
      await this.runLockedTask(async () => {
        const tools = handle.registry.listTools();
        const result = await forceCompact(
          handle.conv,
          handle.client,
          handle.recoveryState,
          tools.map((tool) => tool.name),
          tools.map((tool) => tool.schema()),
        );
        this.sendCommandResult(requestId, name, true, {
          result: { compacted: result.compacted, message: result.message },
        });
      });
      return;
    }
    if (name === "rewind") {
      await this.runRewindCommand(args, requestId);
      return;
    }
  }

  private async runSkillCommand(
    handle: RemoteAgentHandle,
    args: string,
    requestId: string,
  ): Promise<void> {
    const trimmed = args.trim();
    if (trimmed === "reload") {
      handle.skillCatalog?.reload();
      this.sendCommandResult(requestId, "skill", true, {
        result: handle.skillCatalog?.list() ?? [],
      });
      return;
    }
    const [skillName = "", ...rest] = trimmed.split(/\s+/u);
    const skill = handle.skillCatalog?.get(skillName);
    if (skill === undefined) {
      this.sendCommandResult(requestId, "skill", false, {
        error: `Unknown skill: ${skillName}`,
      });
      return;
    }
    const prompt = runInline(skill, rest.join(" "), {
      activateSkill: (activatedName, body) => handle.activeSkills.set(activatedName, body),
    });
    this.sendCommandResult(requestId, "skill", true, { result: { activated: skillName } });
    await this.runTurn({ input: prompt, requestId, turnId: randomUUID() });
  }

  private async runRewindCommand(args: string, requestId: string): Promise<void> {
    const sha = args.trim();
    if (sha.length === 0) {
      const snapshots = await this.git.listSnapshots(this.workDir);
      this.sendCommandResult(requestId, "rewind", true, { result: { snapshots } });
      return;
    }
    const ok = await this.runLockedTask(() => this.git.rewindTo(this.workDir, sha));
    if (ok) this.broadcast({ paths: [], revision: sha, type: "files_changed" });
    this.sendCommandResult(requestId, "rewind", ok, {
      ...(ok ? { result: { rewoundTo: sha } } : { error: "Rewind failed" }),
    });
  }
}
