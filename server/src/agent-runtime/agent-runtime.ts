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
  PermissionChecker,
  type PermissionMode,
  type Question,
  type RemoteAgentHandle,
  runInline,
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
  private sessionId = "";
  private sequence = 0n;
  private currentAbort: AbortController | undefined;
  private currentTurnId: string | null = null;
  private lastActivityMs = Date.now();
  private disposed = false;

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

  private markActivity(): void {
    this.lastActivityMs = Date.now();
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

  private async ensureSession(): Promise<string> {
    if (this.sessionId.length > 0) return this.sessionId;
    const currentId = this.workspace.currentSessionId;
    if (currentId !== null) {
      const existing = await this.stores.sessions.findById(currentId);
      if (existing !== null && existing.status !== "COMPLETED" && existing.status !== "ABORTED") {
        this.sessionId = existing.id;
        this.sequence = existing.lastEventSequence;
        return this.sessionId;
      }
    }
    const session = await this.stores.sessions.create(this.workspaceId);
    await this.stores.workspaces.setCurrentSession(this.workspaceId, session.id);
    this.sessionId = session.id;
    this.sequence = 0n;
    return this.sessionId;
  }

  private async ensureHandle(): Promise<RemoteAgentHandle> {
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
    const rows = await this.stores.transcript.listRecent(sessionId, REPLAY_LIMIT);
    for (const row of rows) {
      const payload = row.payload as { text?: unknown } | null;
      const text = payload !== null && typeof payload.text === "string" ? payload.text : "";
      if (text.length === 0) continue;
      if (row.kind === "user_message") handle.conv.addUserMessage(text);
      else if (row.kind === "assistant_message") handle.conv.addAssistantMessage(text);
    }
  }

  private readonly askUser: Asker = async (questions: Question[]) => {
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
    this.sequence += 1n;
    const row = await this.stores.transcript.append({
      kind,
      payload,
      sequence: this.sequence,
      sessionId: this.sessionId,
      turnId,
    });
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
    return this.lock.run(() => task(this.workDir));
  }

  notifyFilesChanged(paths: readonly string[]): void {
    this.broadcast({ paths: [...paths], type: "files_changed" });
  }

  async ready(connection: AgentConnection): Promise<void> {
    const sessionId = await this.ensureSession();
    connection.send({
      lastSequence: this.sequence.toString(),
      permissionMode: this.workspace.permissionMode,
      readOnly: connection.readOnly,
      sessionId,
      type: "ready",
    });
  }

  async sendBacklog(connection: AgentConnection, afterSequence: bigint): Promise<void> {
    const sessionId = await this.ensureSession();
    const rows = await this.stores.transcript.listAfter(sessionId, afterSequence, 1000);
    connection.send({ events: rows.map(toEventMessage), type: "transcript_batch" });
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
    await this.lock.run(async () => {
      if (this.disposed) return;
      this.markActivity();
      const handle = await this.ensureHandle();
      const sessionId = await this.ensureSession();
      this.currentTurnId = input.turnId;
      const abort = new AbortController();
      this.currentAbort = abort;

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
      } finally {
        this.currentAbort = undefined;
      }

      await this.finalizeTurn(handle, input, adapter);
      this.currentTurnId = null;
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
        lastEventSequence: this.sequence,
        runtimeMetadata: { lastOutcome: outcome, lastTurnId: input.turnId },
      });
    } catch {
      /* snapshot persistence is best-effort */
    }

    await this.setStatus("IDLE");
    this.broadcast({ sessionId: this.sessionId, status: "idle", type: "runtime_status" });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.currentAbort?.abort();
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
      connection.close(1001, "runtime disposed");
    }
    this.connections.clear();
  }

  async resolvePermission(interactionId: string, decision: PermissionDecision): Promise<boolean> {
    this.markActivity();
    return this.broker.resolvePermission(interactionId, decision);
  }

  async resolveQuestion(interactionId: string, answers: QuestionAnswers): Promise<boolean> {
    this.markActivity();
    return this.broker.resolveQuestion(interactionId, answers);
  }

  getCommandCandidates(): CommandCandidate[] {
    return buildCommandCandidates(this.workDir);
  }

  private async startNewSession(): Promise<string> {
    const session = await this.stores.sessions.create(this.workspaceId);
    await this.stores.workspaces.setCurrentSession(this.workspaceId, session.id);
    this.sessionId = session.id;
    this.sequence = 0n;
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
      await this.lock.run(async () => {
        handle.conv.reset();
        await this.startNewSession();
      });
      this.sendCommandResult(requestId, name, true, { result: { sessionId: this.sessionId } });
      this.broadcast({ sessionId: this.sessionId, status: "idle", type: "runtime_status" });
      return;
    }
    if (name === "compact") {
      await this.lock.run(async () => {
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
    const ok = await this.git.rewindTo(this.workDir, sha);
    if (ok) this.broadcast({ paths: [], revision: sha, type: "files_changed" });
    this.sendCommandResult(requestId, "rewind", ok, {
      ...(ok ? { result: { rewoundTo: sha } } : { error: "Rewind failed" }),
    });
  }
}
