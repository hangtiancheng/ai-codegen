import {
  reloadPreview,
  type WebContainer,
  type WebContainerProcess,
} from "@webcontainer/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppFileTree } from "@/shared/api";
import type { AppId } from "@/shared/schemas";
import { getWebContainer } from "@/shared/webcontainer";
import type { PreviewStatus } from "./preview-status";

const MAX_LOG_LENGTH = 12_000;

let operationQueue: Promise<void> = Promise.resolve();
let activePreview:
  | Readonly<{
      appId: AppId;
      process: WebContainerProcess;
      url: string;
    }>
  | undefined;

export type WebContainerPreview = Readonly<{
  clearError: () => void;
  error: string | undefined;
  logs: string;
  previewUrl: string | undefined;
  reload: (iframe: HTMLIFrameElement | null) => void;
  resync: () => void;
  status: PreviewStatus;
}>;

const queueOperation = (operation: () => Promise<void>): Promise<void> => {
  const next = operationQueue.catch(() => undefined).then(operation);
  operationQueue = next.catch(() => undefined);
  return next;
};

const clearProject = async (
  container: WebContainer,
  preserveNodeModules: boolean,
): Promise<void> => {
  const names = await container.fs.readdir(".");
  await Promise.all(
    names
      .filter((name) => !preserveNodeModules || name !== "node_modules")
      .map((name) => container.fs.rm(name, { force: true, recursive: true })),
  );
};

const streamProcessOutput = (
  process: WebContainerProcess,
  appendLog: (chunk: string) => void,
): void => {
  void process.output
    .pipeTo(new WritableStream<string>({ write: appendLog }))
    .catch(() => undefined);
};

const runInstall = async (
  container: WebContainer,
  appendLog: (chunk: string) => void,
): Promise<void> => {
  const process = await container.spawn("npm", ["install"]);
  streamProcessOutput(process, appendLog);
  const exitCode = await process.exit;
  if (exitCode !== 0)
    throw new Error(`npm install exited with code ${exitCode}`);
};

const startDevServer = async (
  container: WebContainer,
  appId: AppId,
  appendLog: (chunk: string) => void,
): Promise<string> => {
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
};

export function useWebContainerPreview(
  appId: AppId,
  enabled: boolean,
): WebContainerPreview {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [logs, setLogs] = useState("");
  const [error, setError] = useState<string>();
  const aliveRef = useRef(true);
  const versionRef = useRef(0);

  const appendLog = useCallback((chunk: string) => {
    if (!aliveRef.current) return;
    setLogs((current) => `${current}${chunk}`.slice(-MAX_LOG_LENGTH));
  }, []);

  const resync = useCallback(() => {
    const version = ++versionRef.current;
    setError(undefined);
    setLogs("");
    void queueOperation(async () => {
      const isCurrent = () =>
        aliveRef.current && version === versionRef.current;
      try {
        if (isCurrent()) setStatus("booting");
        const [container, tree] = await Promise.all([
          getWebContainer(),
          fetchAppFileTree(appId),
        ]);
        if (!isCurrent()) return;
        setStatus("mounting");
        const sameApp = activePreview?.appId === appId;
        if (!sameApp && activePreview !== undefined) {
          activePreview.process.kill();
          activePreview = undefined;
        }
        await clearProject(container, sameApp);
        await container.mount(tree);
        if (!isCurrent()) return;
        setStatus("installing");
        await runInstall(container, appendLog);
        if (!isCurrent()) return;
        if (sameApp && activePreview !== undefined) {
          setPreviewUrl(activePreview.url);
          setStatus("ready");
          return;
        }
        setStatus("starting");
        const url = await startDevServer(container, appId, appendLog);
        if (!isCurrent()) {
          if (activePreview?.appId === appId) {
            activePreview.process.kill();
            activePreview = undefined;
          }
          return;
        }
        setPreviewUrl(url);
        setStatus("ready");
      } catch (cause) {
        if (!isCurrent()) return;
        setError(
          cause instanceof Error ? cause.message : "Preview failed to start",
        );
        setStatus("failed");
      }
    });
  }, [appId, appendLog]);

  const clearError = useCallback(() => {
    setError(undefined);
    setLogs("");
    setStatus((current) => (current === "failed" ? "idle" : current));
  }, []);

  const reload = useCallback((iframe: HTMLIFrameElement | null) => {
    if (iframe === null) return;
    void reloadPreview(iframe);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      versionRef.current += 1;
      if (activePreview?.appId === appId) {
        activePreview.process.kill();
        activePreview = undefined;
      }
    };
  }, [appId]);

  useEffect(() => {
    if (enabled) resync();
  }, [enabled, resync]);

  return { clearError, error, logs, previewUrl, reload, resync, status };
}
