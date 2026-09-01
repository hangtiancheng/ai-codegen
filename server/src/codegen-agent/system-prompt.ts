import { readFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR_PLACEHOLDER = "{{OUTPUT_DIR}}";

export const loadSystemPromptTemplate = (): string =>
  readFileSync(join(process.cwd(), "prompts", "site-generator-system-prompt.md"), "utf8");

export const renderSystemPrompt = (template: string, outputDir: string): string =>
  template.replaceAll(OUTPUT_DIR_PLACEHOLDER, outputDir);
