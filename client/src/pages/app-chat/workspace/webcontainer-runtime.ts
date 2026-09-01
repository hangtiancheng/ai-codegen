import {
  reloadPreview,
  type FileSystemTree,
  type WebContainer,
  type WebContainerProcess,
} from "@webcontainer/api";
import type { AppId } from "@/shared/schemas";
import { getWebContainer } from "@/shared/webcontainer";
import type { PreviewStatus } from "../preview-status";
import { hashContents } from "./workspace-paths";
import { containerHasNodeModules } from "./webcontainer-fs";

const MAX_LOG_LENGTH = 12_000;

type ActivePreview = {
  readonly appId: AppId;
  readonly process: WebContainerProcess;
  readonly url: string;
};

// Module-level singletons: the dev server survives component remounts for the
// same app, and every filesystem mutation is serialized through one queue so
// mounts, installs, saves, and agent syncs never interleave on the FS.
let activePreview: ActivePreview | undefined;
let installedManifestHash: string | undefined;
let fsQueue: Promise<void> = Promise.resolve();

export type PreviewCallbacks = {
  readonly onStatus: (status: PreviewStatus) => void;
  readonly onLog: (chunk: string) => void;
  readonly onReady: (url: string) => void;
  readonly onError: (message: string) => void;
  /** Aborts the run when the owning component unmounted or a newer run began. */
  readonly isCurrent: () => boolean;
};

/** Serialize a filesystem task against every other workspace FS operation. */
export function queueFsTask<T>(task: () => Promise<T>): Promise<T> {
  const run = fsQueue.catch(() => undefined).then(task);
  fsQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function getActivePreviewUrl(appId: AppId): string | undefined {
  return activePreview?.appId === appId ? activePreview.url : undefined;
}

export function reloadPreviewIframe(iframe: HTMLIFrameElement | null): void {
  if (iframe === null) return;
  void reloadPreview(iframe);
}

export function stopPreview(appId: AppId): void {
  if (activePreview?.appId !== appId) return;
  activePreview.process.kill();
  activePreview = undefined;
}

/**
 * Mount the server tree, install dependencies only when the package manifest
 * changed (or `node_modules` is missing), and start the Vite dev server.
 */
export function startPreview(
  appId: AppId,
  tree: FileSystemTree,
  callbacks: PreviewCallbacks,
): Promise<void> {
  return queueFsTask(async () => {
    if (!callbacks.isCurrent()) return;
    try {
      callbacks.onStatus("booting");
      const container = await getWebContainer();
      if (!callbacks.isCurrent()) return;

      const sameApp = activePreview?.appId === appId;
      if (!sameApp && activePreview !== undefined) {
        activePreview.process.kill();
        activePreview = undefined;
      }

      callbacks.onStatus("mounting");
      await clearProject(container, sameApp);
      await container.mount(tree);
      if (!callbacks.isCurrent()) return;

      const manifestHash = manifestHashFromTree(tree);
      const hasNodeModules = await containerHasNodeModules(container);
      const needsInstall =
        !hasNodeModules || manifestHash !== installedManifestHash;
      if (needsInstall) {
        callbacks.onStatus("installing");
        await runInstall(container, callbacks.onLog);
        installedManifestHash = manifestHash;
        if (!callbacks.isCurrent()) return;
      }

      if (sameApp && activePreview !== undefined) {
        callbacks.onReady(activePreview.url);
        callbacks.onStatus("ready");
        return;
      }

      callbacks.onStatus("starting");
      const url = await startDevServer(container, appId, callbacks.onLog);
      if (!callbacks.isCurrent()) {
        stopPreview(appId);
        return;
      }
      callbacks.onReady(url);
      callbacks.onStatus("ready");
    } catch (cause) {
      if (!callbacks.isCurrent()) return;
      callbacks.onError(
        cause instanceof Error ? cause.message : "Preview failed to start",
      );
      callbacks.onStatus("failed");
    }
  });
}

export function clampLog(current: string, chunk: string): string {
  return `${current}${chunk}`.slice(-MAX_LOG_LENGTH);
}

function manifestHashFromTree(tree: FileSystemTree): string | undefined {
  const node = tree["package.json"];
  if (node === undefined || !("file" in node)) return undefined;
  const fileNode = node.file;
  if (!("contents" in fileNode)) return undefined;
  const { contents } = fileNode;
  return hashContents(
    typeof contents === "string"
      ? contents
      : new TextDecoder().decode(contents),
  );
}

async function clearProject(
  container: WebContainer,
  preserveNodeModules: boolean,
): Promise<void> {
  const names = await container.fs.readdir(".");
  await Promise.all(
    names
      .filter((name) => !preserveNodeModules || name !== "node_modules")
      .map((name) => container.fs.rm(name, { force: true, recursive: true })),
  );
}

function streamProcessOutput(
  process: WebContainerProcess,
  appendLog: (chunk: string) => void,
): void {
  void process.output
    .pipeTo(new WritableStream<string>({ write: appendLog }))
    .catch(() => undefined);
}

async function runInstall(
  container: WebContainer,
  appendLog: (chunk: string) => void,
): Promise<void> {
  const process = await container.spawn("npm", ["install"]);
  streamProcessOutput(process, appendLog);
  const exitCode = await process.exit;
  if (exitCode !== 0)
    throw new Error(`npm install exited with code ${exitCode}`);
}

async function startDevServer(
  container: WebContainer,
  appId: AppId,
  appendLog: (chunk: string) => void,
): Promise<string> {
  let unsubscribe: (() => void) | undefined;
  const serverReady = new Promise<string>((resolve) => {
    unsubscribe = container.on("server-ready", (_port, url) => resolve(url));
  });
  const process = await container.spawn("npm", [
    "run",
    "dev",
    "--",
    "--host",
    "0.0.0.0",
  ]);
  streamProcessOutput(process, appendLog);
  const exited = process.exit.then((code) => {
    throw new Error(`Vite exited before becoming ready (code ${code})`);
  });
  try {
    const url = await Promise.race([serverReady, exited]);
    activePreview = { appId, process, url };
    void process.exit.then(() => {
      if (activePreview?.process === process) activePreview = undefined;
    });
    return url;
  } finally {
    unsubscribe?.();
  }
}
