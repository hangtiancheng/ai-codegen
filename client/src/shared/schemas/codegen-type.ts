import { z } from "zod";

export const codegenTypeSchema = z.enum(["VANILLA_HTML", "MULTI_FILES"]);
export type CodegenType = z.infer<typeof codegenTypeSchema>;

export const codegenTypeLabel: Readonly<Record<CodegenType, string>> = {
  VANILLA_HTML: "Vanilla HTML",
  MULTI_FILES: "Multi-files",
};

export function formatCodegenType(value: CodegenType): string {
  return codegenTypeLabel[value];
}
