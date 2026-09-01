import { env } from "../config/index.js";
import type { PrismaDatabaseClient } from "../database/index.js";
import type { MetricsService } from "../observability/index.js";
import { buildCodeOutputDir } from "../project/index.js";
import { AgentRuntime } from "./agent-runtime.js";
import { createGitRuntime, type GitRuntime } from "./git-runtime.js";
import { type AgentStores, createAgentStores } from "./stores.js";

export type RuntimeManagerDeps = Readonly<{
  db: PrismaDatabaseClient;
  metrics: MetricsService;
  projectRootDir?: string;
  idleMs?: number;
}>;

export type SoftSettingsPatch = Parameters<AgentRuntime["applySoftSettings"]>[0];

/**
 * Owns the lifecycle of per-app AgentRuntime instances. Runtimes are keyed by
 * `${ownerId}:${appId}` (the canonical workspace belongs to the app owner), live
 * across connections, and are evicted after an idle window. On shutdown every
 * runtime is disposed (MCP disconnect, hook shutdown, file-history save, abort).
 */
export const createRuntimeManager = (deps: RuntimeManagerDeps) => {
  const stores: AgentStores = createAgentStores(deps.db);
  const git: GitRuntime = createGitRuntime();
  const rootDir = deps.projectRootDir ?? process.cwd();
  const idleMs = deps.idleMs ?? env.AGENT_WORKSPACE_IDLE_MS;
  const runtimes = new Map<string, AgentRuntime>();
  let sweepTimer: NodeJS.Timeout | undefined;

  const keyFor = (ownerId: bigint, appId: bigint): string => `${ownerId}:${appId}`;
  const workDirFor = (appId: bigint): string => buildCodeOutputDir(rootDir, appId.toString());

  const getOrCreate = async (ownerId: bigint, appId: bigint): Promise<AgentRuntime> => {
    const key = keyFor(ownerId, appId);
    const existing = runtimes.get(key);
    if (existing !== undefined) return existing;
    const workspace = await stores.workspaces.getOrCreate(ownerId, appId);
    const runtime = new AgentRuntime({
      appId,
      git,
      metrics: deps.metrics,
      stores,
      workDir: workDirFor(appId),
      workspace,
    });
    runtimes.set(key, runtime);
    return runtime;
  };

  const invalidate = async (ownerId: bigint, appId: bigint): Promise<void> => {
    const key = keyFor(ownerId, appId);
    const runtime = runtimes.get(key);
    if (runtime === undefined) return;
    runtimes.delete(key);
    await runtime.dispose();
  };

  const applySoftSettings = (ownerId: bigint, appId: bigint, patch: SoftSettingsPatch): void => {
    runtimes.get(keyFor(ownerId, appId))?.applySoftSettings(patch);
  };

  const sweep = (): void => {
    const now = Date.now();
    for (const [key, runtime] of [...runtimes.entries()]) {
      if (now - runtime.lastActivity > idleMs) {
        runtimes.delete(key);
        void runtime.dispose();
      }
    }
  };

  const start = (): void => {
    if (sweepTimer !== undefined) return;
    sweepTimer = setInterval(sweep, 60_000);
    sweepTimer.unref?.();
  };

  const disposeAll = async (): Promise<void> => {
    if (sweepTimer !== undefined) {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
    }
    const all = [...runtimes.values()];
    runtimes.clear();
    await Promise.all(all.map((runtime) => runtime.dispose()));
  };

  start();

  return { applySoftSettings, disposeAll, getOrCreate, git, invalidate, stores, workDirFor };
};

export type RuntimeManager = ReturnType<typeof createRuntimeManager>;
