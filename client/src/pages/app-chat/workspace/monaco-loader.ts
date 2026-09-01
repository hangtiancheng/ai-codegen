import type * as Monaco from "monaco-editor";
import { configureMonacoWorkers } from "./monaco-workers";

/**
 * Lazily import `monaco-editor` so its large bundle and language workers are
 * only fetched the first time the Code tab is opened. The module is cached, so
 * later calls resolve immediately and the editor can stay mounted.
 */

export type MonacoModule = typeof Monaco;

let monacoPromise: Promise<MonacoModule> | undefined;

export function loadMonaco(): Promise<MonacoModule> {
  monacoPromise ??= importMonaco();
  return monacoPromise;
}

async function importMonaco(): Promise<MonacoModule> {
  try {
    configureMonacoWorkers();
    return await import("monaco-editor");
  } catch (error) {
    monacoPromise = undefined;
    throw error;
  }
}
