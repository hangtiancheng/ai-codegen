import type { BuildProjectResult, ParsedProject, SaveProjectResult } from "../project/index";
import type { ViteCodegenLogger, ViteCodegenLogSession } from "./vite-codegen-logger";
import type { CodegenStreamMetadata, ExecuteWorkflowInput } from "./workflow-types";

export const createViteLogSession = async (
  logger: ViteCodegenLogger,
  input: ExecuteWorkflowInput,
): Promise<ViteCodegenLogSession> => {
  const session = await logger.createSession({
    appId: input.appId.toString(),
    userId: input.userId.toString(),
    userPrompt: input.userPrompt,
  });
  await session.info({ message: "Codegen workflow started", stage: "start" });
  return session;
};

export const logGeneratedCode = async (
  session: ViteCodegenLogSession,
  attempt: number,
  generatedCode: string,
  metadata: CodegenStreamMetadata | undefined,
): Promise<void> => {
  await session.writeArtifact(`attempt-${String(attempt)}-generated-code.md`, generatedCode);
  await session.info({
    attempt,
    details: {
      characters: generatedCode.length,
      ...(metadata !== undefined && { finalChunk: metadata }),
    },
    message: "Streaming code generation completed",
    stage: "codegen",
  });
};

export const logPartialGeneratedCode = async (
  session: ViteCodegenLogSession,
  attempt: number,
  generatedCode: string,
  error: unknown,
): Promise<void> => {
  await session.writeArtifact(
    `attempt-${String(attempt)}-partial-generated-code.md`,
    generatedCode,
  );
  await session.info({
    attempt,
    details: { characters: generatedCode.length, error: describeError(error) },
    message: "Streaming code generation failed before completion",
    stage: "error",
  });
};

export const logQualityCheck = async (
  session: ViteCodegenLogSession,
  attempt: number,
  message: string,
  passed: boolean,
): Promise<void> => {
  await session.writeArtifact(`attempt-${String(attempt)}-quality-check.txt`, message);
  await session.info({
    attempt,
    details: { passed },
    message: "Quality check completed",
    stage: "quality-check",
  });
};

export const logWorkflowError = async (
  session: ViteCodegenLogSession,
  error: unknown,
): Promise<void> => {
  await session.writeArtifact("workflow-error.json", JSON.stringify(describeError(error), null, 2));
  await session.info({
    details: { error: describeError(error) },
    message: "Codegen workflow failed unexpectedly",
    stage: "error",
  });
};

export const logParsedProject = async (
  session: ViteCodegenLogSession,
  parsed: ParsedProject,
): Promise<void> => {
  await session.writeArtifact("parsed-files.json", JSON.stringify(parsed.files, null, 2));
  await session.info({
    details: { files: parsed.files.map((file) => file.filename) },
    message: "Generated code parsed into project files",
    stage: "parse",
  });
};

export const logSavedProject = async (
  session: ViteCodegenLogSession,
  saved: SaveProjectResult,
): Promise<void> => {
  await session.writeArtifact("written-files.json", JSON.stringify(saved.writtenFiles, null, 2));
  await session.info({
    details: { outputDir: saved.outputDir, writtenFiles: saved.writtenFiles },
    message: "Generated project files saved",
    stage: "save-project",
  });
};

export const logBuildCompleted = async (
  session: ViteCodegenLogSession,
  build: BuildProjectResult,
): Promise<void> => {
  await session.writeArtifact("build.log", build.logs);
  await session.info({
    details: { success: build.success },
    message: "Vite project build completed",
    stage: "project-build",
  });
};

const describeError = (
  error: unknown,
): Readonly<{ message: string; name: string; stack?: string }> => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      ...(error.stack !== undefined && { stack: error.stack }),
    };
  }
  return { message: String(error), name: "UnknownError" };
};
