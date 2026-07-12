import type { CodegenType } from "../generated/prisma/enums.js";

export type CodegenStreamMetadata = Readonly<{
  response_metadata?: Readonly<{
    done_reason?: string;
    eval_count?: number;
  }>;
  usage_metadata?: Readonly<{
    output_tokens?: number;
  }>;
}>;

export type CodegenStreamChunk = Readonly<{
  content: string;
  metadata?: CodegenStreamMetadata;
}>;

export type CodeGenerator = Readonly<{
  streamCode: (input: {
    codegenType: CodegenType;
    prompt: string;
  }) => AsyncIterable<CodegenStreamChunk>;
}>;

export type QualityChecker = Readonly<{
  check: (input: { code: string; codegenType: CodegenType }) => Promise<{
    message: string;
    passed: boolean;
  }>;
}>;

export type WorkflowChatWriter = Readonly<{
  writeAiMessage: (input: { appId: bigint; message: string; userId: bigint }) => Promise<void>;
  writeUserMessage: (input: { appId: bigint; message: string; userId: bigint }) => Promise<void>;
}>;

export type CodegenWorkflowDeps = Readonly<{
  chatWriter: WorkflowChatWriter;
  codeGenerator: CodeGenerator;
  maxAttempts?: number;
  outputRootDir?: string;
  qualityChecker: QualityChecker;
}>;

export type ExecuteWorkflowInput = Readonly<{
  appId: bigint;
  codegenType: CodegenType;
  userId: bigint;
  userPrompt: string;
}>;
