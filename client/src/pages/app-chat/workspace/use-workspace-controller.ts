import type { IFSWatcher, WebContainer } from "@webcontainer/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWebContainer } from "@/shared/webcontainer";
import type { AppId } from "@/shared/schemas";
import type { PreviewStatus } from "../preview-status";
import { usePreviewErrors } from "../use-preview-errors";
import { useVisualEditor } from "../use-visual-editor";
import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  fetchWorkspaceTree,
  isSaveConflict,
  renameWorkspacePath,
  saveWorkspaceFile,
  type SaveFileInput,
  type SaveFileResult,
} from "./agent-files-api";
import { startShellSession } from "./webcontainer-terminal";
import {
  clampLog,
  getActivePreviewUrl,
  queueFsTask,
  reloadPreviewIframe,
  startPreview,
  stopPreview,
  type PreviewCallbacks,
} from "./webcontainer-runtime";
import {
  createContainerDirectory,
  readContainerText,
  removeContainerPath,
  renameContainerPath,
  walkContainerTree,
  writeContainerText,
} from "./webcontainer-fs";
import {
  hashContents,
  isBinaryPath,
  isIgnoredPath,
  joinPath,
  normalizePath,
} from "./workspace-paths";
import {
  agentTreeToFileSystem,
  snapshotFromAgentTree,
  threeWayMerge,
  type WorkspaceFileContent,
  type WorkspaceNode,
} from "./workspace-tree";
import type {
  TerminalHandle,
  TerminalSurface,
  WorkspaceController,
  WorkspaceFileState,
} from "./workspace-types";

const SYNC_DEBOUNCE_MS = 250;
const decoder = new TextDecoder();

export type WorkspaceControllerOptions = {
  readonly appId: AppId;
  readonly enabled: boolean;
  readonly agentRunning: boolean;
};

// REST calls degrade gracefully: until the server file-sync endpoints exist the
// workspace still edits the in-browser working copy, so failures are swallowed.
async function safeSave(
  appId: AppId,
  input: SaveFileInput,
): Promise<SaveFileResult | undefined> {
  try {
    return await saveWorkspaceFile(appId, input);
  } catch {
    return undefined;
  }
}

async function safeRest(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch {
    // Ignored: the local working copy remains the source of truth.
  }
}

function remapPath(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

export function useWorkspaceController(
  options: WorkspaceControllerOptions,
): WorkspaceController {
  const { appId, enabled, agentRunning } = options;

  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [logs, setLogs] = useState("");
  const [error, setError] = useState<string>();
  const [tree, setTree] = useState<readonly WorkspaceNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [openPaths, setOpenPaths] = useState<readonly string[]>([]);
  const [activePath, setActivePathState] = useState<string>();
  const [files, setFiles] = useState<ReadonlyMap<string, WorkspaceFileState>>(
    new Map(),
  );
  const [busyCount, setBusyCount] = useState(0);

  const aliveRef = useRef(true);
  const versionRef = useRef(0);
  const filesRef = useRef<ReadonlyMap<string, WorkspaceFileState>>(files);
  const serverSnapshotRef = useRef<Map<string, WorkspaceFileContent>>(
    new Map(),
  );
  const suppressRef = useRef<Set<string>>(new Set());
  const watcherRef = useRef<IFSWatcher | undefined>(undefined);
  const changedPathsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const terminalSyncChainRef = useRef<Promise<void>>(Promise.resolve());
  const agentRunningRef = useRef(agentRunning);
  const prevAgentRunningRef = useRef(agentRunning);

  const visualEditor = useVisualEditor(previewUrl);
  const previewErrors = usePreviewErrors();
  const { iframeRef } = visualEditor;

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const isCurrent = useCallback(
    (version: number): boolean =>
      aliveRef.current && version === versionRef.current,
    [],
  );

  const putFile = useCallback(
    (
      path: string,
      build: (prev: WorkspaceFileState | undefined) => WorkspaceFileState,
    ): void => {
      setFiles((prev) => {
        const next = new Map(prev);
        next.set(path, build(prev.get(path)));
        return next;
      });
    },
    [],
  );

  // Replace a buffer from an authoritative external source (open, agent sync,
  // conflict resolution). Bumps revision so the editor resets its model.
  const applyExternalContents = useCallback(
    (
      path: string,
      contents: string,
      serverText: string,
      serverHash: string | null,
    ): void => {
      putFile(path, (prev) => ({
        path,
        binary: false,
        contents,
        baseText: serverText,
        baseHash: hashContents(serverText),
        serverHash,
        dirty: hashContents(contents) !== hashContents(serverText),
        revision: (prev?.revision ?? 0) + 1,
        conflict: undefined,
      }));
    },
    [putFile],
  );

  const flushChangedNow = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    const paths = [...changedPathsRef.current];
    changedPathsRef.current.clear();
    if (paths.length === 0) return;
    const task = (async (): Promise<void> => {
      let container: WebContainer;
      try {
        container = await getWebContainer();
      } catch {
        return;
      }
      for (const path of paths) {
        try {
          const text = await readContainerText(container, path);
          const base = serverSnapshotRef.current.get(path);
          const result = await safeSave(appId, {
            path,
            contents: text,
            expectedHash: base?.hash ?? null,
          });
          const nextHash =
            result !== undefined && !isSaveConflict(result)
              ? result.hash
              : (result?.serverHash ?? base?.hash ?? "");
          serverSnapshotRef.current.set(path, {
            binary: false,
            text,
            hash: nextHash,
          });
          const open = filesRef.current.get(path);
          if (open !== undefined && !open.dirty && !open.binary) {
            applyExternalContents(path, text, text, nextHash);
          }
        } catch {
          // The path is a directory or was removed before we read it.
        }
      }
      try {
        setTree(await walkContainerTree(container));
      } catch {
        // Tree refresh is best-effort.
      }
    })();
    terminalSyncChainRef.current = terminalSyncChainRef.current.then(
      () => task,
      () => task,
    );
    await task;
  }, [appId, applyExternalContents]);

  const scheduleTerminalSync = useCallback(
    (path: string): void => {
      if (agentRunningRef.current) return;
      changedPathsRef.current.add(path);
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        void flushChangedNow();
      }, SYNC_DEBOUNCE_MS);
    },
    [flushChangedNow],
  );

  const startWatcher = useCallback(
    (container: WebContainer): void => {
      watcherRef.current?.close();
      watcherRef.current = container.fs.watch(
        ".",
        { recursive: true },
        (_event, filename) => {
          const raw =
            typeof filename === "string" ? filename : decoder.decode(filename);
          const path = normalizePath(raw);
          if (path === "" || isIgnoredPath(path)) return;
          if (suppressRef.current.has(path)) {
            suppressRef.current.delete(path);
            return;
          }
          scheduleTerminalSync(path);
        },
      );
    },
    [scheduleTerminalSync],
  );

  const makePreviewCallbacks = useCallback(
    (version: number): PreviewCallbacks => ({
      onStatus: (next) => {
        if (isCurrent(version)) setStatus(next);
      },
      onLog: (chunk) => {
        if (isCurrent(version)) setLogs((current) => clampLog(current, chunk));
      },
      onReady: (url) => {
        if (isCurrent(version)) setPreviewUrl(url);
      },
      onError: (message) => {
        if (isCurrent(version)) setError(message);
      },
      isCurrent: () => isCurrent(version),
    }),
    [isCurrent],
  );

  const boot = useCallback((): void => {
    const version = ++versionRef.current;
    setError(undefined);
    setLogs("");
    setTreeLoading(true);
    void (async () => {
      try {
        const root = await fetchWorkspaceTree(appId);
        if (!isCurrent(version)) return;
        const snapshot = snapshotFromAgentTree(root);
        serverSnapshotRef.current = new Map(snapshot.files);
        setTree(snapshot.nodes);
        setTreeLoading(false);
        await startPreview(
          appId,
          agentTreeToFileSystem(root),
          makePreviewCallbacks(version),
        );
        if (!isCurrent(version)) return;
        const container = await getWebContainer();
        setTree(await walkContainerTree(container));
        startWatcher(container);
      } catch (cause) {
        if (!isCurrent(version)) return;
        setTreeLoading(false);
        setError(
          cause instanceof Error ? cause.message : "Preview failed to start",
        );
        setStatus("failed");
      }
    })();
  }, [appId, isCurrent, makePreviewCallbacks, startWatcher]);

  const resyncAfterAgent = useCallback((): void => {
    const version = versionRef.current;
    void (async () => {
      let root;
      try {
        root = await fetchWorkspaceTree(appId);
      } catch {
        return;
      }
      if (!isCurrent(version)) return;
      const newServer = snapshotFromAgentTree(root).files;
      const prevServer = serverSnapshotRef.current;
      const manifestChanged =
        newServer.get("package.json")?.text !==
        prevServer.get("package.json")?.text;
      if (manifestChanged) {
        serverSnapshotRef.current = new Map(newServer);
        await startPreview(
          appId,
          agentTreeToFileSystem(root),
          makePreviewCallbacks(version),
        );
        if (!isCurrent(version)) return;
        const container = await getWebContainer();
        setTree(await walkContainerTree(container));
        startWatcher(container);
        return;
      }
      await queueFsTask(async () => {
        const container = await getWebContainer();
        for (const [path, server] of newServer) {
          const prev = prevServer.get(path);
          const buffer = filesRef.current.get(path);
          if (
            buffer !== undefined &&
            buffer.dirty &&
            !buffer.binary &&
            server.text !== undefined
          ) {
            const merged = threeWayMerge(
              buffer.baseText,
              buffer.contents,
              server.text,
            );
            suppressRef.current.add(path);
            if (merged.clean) {
              await writeContainerText(container, path, merged.text);
              applyExternalContents(
                path,
                merged.text,
                server.text,
                server.hash,
              );
            } else {
              await writeContainerText(container, path, server.text);
              putFile(path, (prevState) => ({
                ...(prevState ?? buffer),
                serverHash: server.hash,
                conflict: {
                  path,
                  base: buffer.baseText,
                  local: buffer.contents,
                  server: server.text ?? "",
                },
              }));
            }
            continue;
          }
          if (server.text !== undefined && prev?.text !== server.text) {
            suppressRef.current.add(path);
            await writeContainerText(container, path, server.text);
            if (buffer !== undefined && !buffer.binary) {
              applyExternalContents(
                path,
                server.text,
                server.text,
                server.hash,
              );
            }
          }
        }
        for (const [path] of prevServer) {
          if (newServer.has(path)) continue;
          const buffer = filesRef.current.get(path);
          if (buffer?.dirty === true) continue;
          suppressRef.current.add(path);
          await removeContainerPath(container, path);
          setFiles((prevMap) => {
            const nextMap = new Map(prevMap);
            nextMap.delete(path);
            return nextMap;
          });
          setOpenPaths((prevPaths) =>
            prevPaths.filter((item) => item !== path),
          );
        }
        serverSnapshotRef.current = new Map(newServer);
        setTree(await walkContainerTree(container));
      });
      if (!isCurrent(version)) return;
      reloadPreviewIframe(iframeRef.current);
    })();
  }, [
    appId,
    applyExternalContents,
    iframeRef,
    isCurrent,
    makePreviewCallbacks,
    putFile,
    startWatcher,
  ]);

  const refreshTree = useCallback((): void => {
    void (async () => {
      try {
        const container = await getWebContainer();
        setTree(await walkContainerTree(container));
      } catch {
        // Ignore: the container is not ready yet.
      }
    })();
  }, []);

  const openFile = useCallback(
    (path: string): void => {
      const normalized = normalizePath(path);
      setOpenPaths((prev) =>
        prev.includes(normalized) ? prev : [...prev, normalized],
      );
      setActivePathState(normalized);
      if (isBinaryPath(normalized)) {
        putFile(normalized, (prev) => ({
          path: normalized,
          binary: true,
          contents: "",
          baseText: "",
          baseHash: hashContents(""),
          serverHash: serverSnapshotRef.current.get(normalized)?.hash ?? null,
          dirty: false,
          revision: (prev?.revision ?? 0) + 1,
          conflict: undefined,
        }));
        return;
      }
      if (filesRef.current.has(normalized)) return;
      void (async () => {
        try {
          const container = await getWebContainer();
          const text = await readContainerText(container, normalized);
          const known = serverSnapshotRef.current.get(normalized);
          const serverText = known?.text ?? text;
          applyExternalContents(
            normalized,
            text,
            serverText,
            known?.hash ?? null,
          );
        } catch {
          // File vanished before it could be opened.
        }
      })();
    },
    [applyExternalContents, putFile],
  );

  const closeFile = useCallback((path: string): void => {
    const normalized = normalizePath(path);
    setOpenPaths((prev) => {
      const next = prev.filter((item) => item !== normalized);
      setActivePathState((current) =>
        current === normalized ? next.at(-1) : current,
      );
      return next;
    });
  }, []);

  const setActivePath = useCallback((path: string): void => {
    setActivePathState(normalizePath(path));
  }, []);

  const getFileState = useCallback(
    (path: string): WorkspaceFileState | undefined =>
      files.get(normalizePath(path)),
    [files],
  );

  const updateFileContents = useCallback(
    (path: string, contents: string): void => {
      const normalized = normalizePath(path);
      putFile(normalized, (prev) => {
        const binary = prev?.binary ?? isBinaryPath(normalized);
        const baseText = prev?.baseText ?? contents;
        const baseHash = prev?.baseHash ?? hashContents(contents);
        return {
          path: normalized,
          binary,
          contents,
          baseText,
          baseHash,
          serverHash: prev?.serverHash ?? null,
          dirty: !binary && hashContents(contents) !== baseHash,
          revision: prev?.revision ?? 1,
          conflict: prev?.conflict,
        };
      });
    },
    [putFile],
  );

  const saveFile = useCallback(
    (path: string): void => {
      const normalized = normalizePath(path);
      void queueFsTask(async () => {
        const file = filesRef.current.get(normalized);
        if (file === undefined || file.binary || !file.dirty) return;
        setBusyCount((count) => count + 1);
        try {
          const container = await getWebContainer();
          const result = await safeSave(appId, {
            path: normalized,
            contents: file.contents,
            expectedHash: file.serverHash,
          });
          if (result !== undefined && isSaveConflict(result)) {
            putFile(normalized, (prev) => ({
              ...(prev ?? file),
              serverHash: result.serverHash,
              conflict: {
                path: normalized,
                base: file.baseText,
                local: file.contents,
                server: result.serverContents,
              },
            }));
            return;
          }
          suppressRef.current.add(normalized);
          await writeContainerText(container, normalized, file.contents);
          const savedHash =
            result !== undefined && !isSaveConflict(result) ? result.hash : "";
          serverSnapshotRef.current.set(normalized, {
            binary: false,
            text: file.contents,
            hash: savedHash,
          });
          putFile(normalized, () => ({
            path: normalized,
            binary: false,
            contents: file.contents,
            baseText: file.contents,
            baseHash: hashContents(file.contents),
            serverHash: savedHash,
            dirty: false,
            revision: file.revision,
            conflict: undefined,
          }));
        } finally {
          setBusyCount((count) => count - 1);
        }
      });
    },
    [appId, putFile],
  );

  const saveAll = useCallback((): void => {
    for (const [path, file] of filesRef.current) {
      if (file.dirty && !file.binary && file.conflict === undefined) {
        saveFile(path);
      }
    }
  }, [saveFile]);

  const createFile = useCallback(
    (parentDir: string, name: string): void => {
      const path = joinPath(parentDir, name);
      void queueFsTask(async () => {
        setBusyCount((count) => count + 1);
        try {
          const container = await getWebContainer();
          suppressRef.current.add(path);
          await writeContainerText(container, path, "");
          const result = await safeSave(appId, {
            path,
            contents: "",
            expectedHash: null,
          });
          const createdHash =
            result !== undefined && !isSaveConflict(result) ? result.hash : "";
          serverSnapshotRef.current.set(path, {
            binary: isBinaryPath(path),
            text: isBinaryPath(path) ? undefined : "",
            hash: createdHash,
          });
          setTree(await walkContainerTree(container));
        } finally {
          setBusyCount((count) => count - 1);
        }
      }).then(
        () => openFile(path),
        () => undefined,
      );
    },
    [appId, openFile],
  );

  const createDirectory = useCallback(
    (parentDir: string, name: string): void => {
      const path = joinPath(parentDir, name);
      void queueFsTask(async () => {
        setBusyCount((count) => count + 1);
        try {
          const container = await getWebContainer();
          suppressRef.current.add(path);
          await createContainerDirectory(container, path);
          await safeRest(() => createWorkspaceDirectory(appId, path));
          setTree(await walkContainerTree(container));
        } finally {
          setBusyCount((count) => count - 1);
        }
      });
    },
    [appId],
  );

  const renamePath = useCallback(
    (from: string, to: string): void => {
      const source = normalizePath(from);
      const target = normalizePath(to);
      if (source === target) return;
      void queueFsTask(async () => {
        setBusyCount((count) => count + 1);
        try {
          const container = await getWebContainer();
          suppressRef.current.add(source);
          suppressRef.current.add(target);
          await renameContainerPath(container, source, target);
          await safeRest(() => renameWorkspacePath(appId, source, target));
          const nextSnapshot = new Map<string, WorkspaceFileContent>();
          for (const [path, content] of serverSnapshotRef.current) {
            nextSnapshot.set(remapPath(path, source, target), content);
          }
          serverSnapshotRef.current = nextSnapshot;
          setFiles((prev) => {
            const next = new Map<string, WorkspaceFileState>();
            for (const [path, state] of prev) {
              const mapped = remapPath(path, source, target);
              next.set(
                mapped,
                mapped === path ? state : { ...state, path: mapped },
              );
            }
            return next;
          });
          setOpenPaths((prev) =>
            prev.map((path) => remapPath(path, source, target)),
          );
          setActivePathState((prev) =>
            prev === undefined ? prev : remapPath(prev, source, target),
          );
          setTree(await walkContainerTree(container));
        } finally {
          setBusyCount((count) => count - 1);
        }
      });
    },
    [appId],
  );

  const deletePath = useCallback(
    (path: string): void => {
      const target = normalizePath(path);
      void queueFsTask(async () => {
        setBusyCount((count) => count + 1);
        try {
          const container = await getWebContainer();
          suppressRef.current.add(target);
          await removeContainerPath(container, target);
          await safeRest(() => deleteWorkspacePath(appId, target));
          for (const key of [...serverSnapshotRef.current.keys()]) {
            if (isUnder(key, target)) serverSnapshotRef.current.delete(key);
          }
          setFiles((prev) => {
            const next = new Map(prev);
            for (const key of [...next.keys()]) {
              if (isUnder(key, target)) next.delete(key);
            }
            return next;
          });
          setOpenPaths((prev) => prev.filter((item) => !isUnder(item, target)));
          setActivePathState((prev) =>
            prev !== undefined && isUnder(prev, target) ? undefined : prev,
          );
          setTree(await walkContainerTree(container));
        } finally {
          setBusyCount((count) => count - 1);
        }
      });
    },
    [appId],
  );

  const acceptAgentChanges = useCallback(
    (path: string): void => {
      const normalized = normalizePath(path);
      const file = filesRef.current.get(normalized);
      const conflict = file?.conflict;
      if (conflict === undefined) return;
      const serverHash = file?.serverHash ?? null;
      void queueFsTask(async () => {
        const container = await getWebContainer();
        suppressRef.current.add(normalized);
        await writeContainerText(container, normalized, conflict.server);
        serverSnapshotRef.current.set(normalized, {
          binary: false,
          text: conflict.server,
          hash: serverHash ?? "",
        });
        applyExternalContents(
          normalized,
          conflict.server,
          conflict.server,
          serverHash,
        );
      });
    },
    [applyExternalContents],
  );

  const keepLocalChanges = useCallback(
    (path: string): void => {
      const normalized = normalizePath(path);
      const file = filesRef.current.get(normalized);
      if (file === undefined || file.conflict === undefined) return;
      const conflict = file.conflict;
      const expectedHash = file.serverHash;
      void queueFsTask(async () => {
        const container = await getWebContainer();
        const result = await safeSave(appId, {
          path: normalized,
          contents: conflict.local,
          expectedHash,
        });
        if (result !== undefined && isSaveConflict(result)) {
          putFile(normalized, (prev) => ({
            ...(prev ?? file),
            serverHash: result.serverHash,
            conflict: {
              path: normalized,
              base: conflict.server,
              local: conflict.local,
              server: result.serverContents,
            },
          }));
          return;
        }
        suppressRef.current.add(normalized);
        await writeContainerText(container, normalized, conflict.local);
        const savedHash =
          result !== undefined && !isSaveConflict(result) ? result.hash : "";
        serverSnapshotRef.current.set(normalized, {
          binary: false,
          text: conflict.local,
          hash: savedHash,
        });
        applyExternalContents(
          normalized,
          conflict.local,
          conflict.local,
          savedHash,
        );
      });
    },
    [appId, applyExternalContents, putFile],
  );

  const attachTerminal = useCallback(
    (surface: TerminalSurface): TerminalHandle => {
      let disposed = false;
      let session: Awaited<ReturnType<typeof startShellSession>> | undefined;
      const pendingInput: string[] = [];
      void (async () => {
        try {
          const container = await getWebContainer();
          const started = await startShellSession(
            container,
            { cols: surface.cols, rows: surface.rows },
            surface.onOutput,
          );
          if (disposed) {
            started.dispose();
            return;
          }
          session = started;
          for (const chunk of pendingInput) started.write(chunk);
          pendingInput.length = 0;
          surface.onReady?.();
        } catch {
          // The shell could not start; the terminal stays passive.
        }
      })();
      return {
        write: (data) => {
          if (disposed) return;
          if (session === undefined) pendingInput.push(data);
          else session.write(data);
        },
        resize: (cols, rows) => session?.resize(cols, rows),
        dispose: () => {
          disposed = true;
          session?.dispose();
          session = undefined;
        },
      };
    },
    [],
  );

  const flushTerminalSync = useCallback(async (): Promise<void> => {
    await flushChangedNow();
    await terminalSyncChainRef.current;
  }, [flushChangedNow]);

  const reloadPreview = useCallback((): void => {
    reloadPreviewIframe(iframeRef.current);
  }, [iframeRef]);

  const clearError = useCallback((): void => {
    setError(undefined);
    setLogs("");
    setStatus((current) => (current === "failed" ? "idle" : current));
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      versionRef.current += 1;
      watcherRef.current?.close();
      watcherRef.current = undefined;
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
      stopPreview(appId);
    };
  }, [appId]);

  useEffect(() => {
    if (enabled) boot();
  }, [enabled, boot]);

  useEffect(() => {
    agentRunningRef.current = agentRunning;
    if (!agentRunning && prevAgentRunningRef.current && enabled) {
      resyncAfterAgent();
    }
    prevAgentRunningRef.current = agentRunning;
  }, [agentRunning, enabled, resyncAfterAgent]);

  const resolvedPreviewUrl = previewUrl ?? getActivePreviewUrl(appId);

  return {
    previewUrl: resolvedPreviewUrl,
    status,
    error,
    logs,
    reloadPreview,
    clearError,
    resync: boot,
    resyncAfterAgent,
    iframeRef,
    editMode: visualEditor.editMode,
    selectedElement: visualEditor.selectedElement,
    toggleEditMode: visualEditor.toggleEditMode,
    clearSelection: visualEditor.clearSelection,
    handleIframeLoad: visualEditor.handleIframeLoad,
    previewError: previewErrors.latest,
    clearPreviewError: previewErrors.clear,
    tree,
    treeLoading,
    refreshTree,
    openPaths,
    activePath,
    openFile,
    closeFile,
    setActivePath,
    getFileState,
    updateFileContents,
    saveFile,
    saveAll,
    createFile,
    createDirectory,
    renamePath,
    deletePath,
    acceptAgentChanges,
    keepLocalChanges,
    attachTerminal,
    flushTerminalSync,
    agentRunning,
    busy: busyCount > 0,
  };
}
