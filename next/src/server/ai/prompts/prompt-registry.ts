import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CodegenType } from "@/generated/prisma/enums";

const promptsDir = (): string => join(process.cwd(), "prompts");

const readPrompt = (filename: string): string =>
  readFileSync(join(promptsDir(), filename), { encoding: "utf-8" });

export const SYSTEM_PROMPTS: Readonly<Record<CodegenType, string>> = {
  [CodegenType.MULTI_FILES]: readPrompt("multi-files-system-prompt.md"),
  [CodegenType.VANILLA_HTML]: readPrompt("vanilla-html-system-prompt.md"),
  [CodegenType.VITE_PROJECT]: readPrompt("vite-project-system-prompt.md"),
};

export const ROUTE_SYSTEM_PROMPT: string = readPrompt("route-system-prompt.md");

export const CODE_QUALITY_CHECK_SYSTEM_PROMPT =
  "You are a frontend master, review the generated code.";

export const getSystemPrompt = (codegenType: CodegenType): string => SYSTEM_PROMPTS[codegenType];
