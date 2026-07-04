import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ViteCodegenLogStage =
  | "start"
  | "chat-history"
  | "codegen"
  | "quality-check"
  | "parse"
  | "save-project"
  | "project-build"
  | "copy-dist"
  | "screenshot"
  | "complete"
  | "error";

export type ViteProjectLogOperation = "codegen" | "deploy";

export type ViteCodegenLogSessionInput = Readonly<{
  appId: string;
  deployKey?: string;
  operation?: ViteProjectLogOperation;
  userId?: string;
  userPrompt?: string;
}>;

export type ViteCodegenLogEvent = Readonly<{
  attempt?: number;
  details?: unknown;
  message: string;
  stage: ViteCodegenLogStage;
}>;

export type ViteCodegenLogSession = Readonly<{
  info: (event: ViteCodegenLogEvent) => Promise<void>;
  writeArtifact: (filename: string, content: string) => Promise<void>;
}>;

export type ViteCodegenLogger = Readonly<{
  createSession: (input: ViteCodegenLogSessionInput) => Promise<ViteCodegenLogSession>;
}>;

// === RegExp ===
const sanitizePathSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";

// === RegExp ===
const createTimestamp = (): string => new Date().toISOString().replace(/[:.]/gu, "-");

const serializeJson = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
const serializeJsonLine = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item,
  );

const writeJson = (filename: string, value: unknown): Promise<void> =>
  writeFile(filename, `${serializeJson(value)}\n`, "utf-8");

const formatConsoleLine = (
  input: ViteCodegenLogSessionInput,
  event: ViteCodegenLogEvent,
): string => {
  const attempt = event.attempt === undefined ? "" : ` attempt=${String(event.attempt)}`;
  const operation = input.operation ?? "codegen";
  const user = input.userId === undefined ? "" : ` userId=${input.userId}`;
  return `[vite-project-${operation}] appId=${input.appId}${user} stage=${event.stage}${attempt} ${event.message}`;
};

export const createNoopViteCodegenLogger = (): ViteCodegenLogger => ({
  createSession: async () => ({
    info: async () => undefined,
    writeArtifact: async () => undefined,
  }),
});

export const createFileViteCodegenLogger = (
  rootDir = join(process.cwd(), "logs"),
): ViteCodegenLogger => ({
  createSession: async (input) => {
    const operation = input.operation ?? "codegen";
    const prefix =
      operation === "deploy"
        ? `vite-project-deploy-${sanitizePathSegment(input.appId)}`
        : `vite-project-${sanitizePathSegment(input.appId)}`;
    const sessionDir = join(rootDir, `${prefix}-${createTimestamp()}`);
    const eventsFile = join(sessionDir, "events.ndjson");
    await mkdir(sessionDir, { recursive: true });
    await writeJson(join(sessionDir, "input.json"), { ...input, operation });
    console.info(`[vite-project-${operation}] logs=${sessionDir}`);

    return {
      info: async (event) => {
        console.info(formatConsoleLine(input, event));
        await appendFile(
          eventsFile,
          `${serializeJsonLine({
            ...event,
            appId: input.appId,
            ...(input.deployKey !== undefined && {
              deployKey: input.deployKey,
            }),
            loggedAt: new Date().toISOString(),
            operation,
            ...(input.userId !== undefined && { userId: input.userId }),
          })}\n`,
          "utf-8",
        );
      },
      writeArtifact: async (filename, content) => {
        const safeFilename = sanitizePathSegment(filename);
        await writeFile(join(sessionDir, safeFilename), content, "utf-8");
      },
    };
  },
});
