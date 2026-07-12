import { ErrorCode, HttpError } from "../common/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import { extractMarkdownCodeBlocks } from "./markdown-code-blocks.js";

export const parsedProjectFileSchema = {
  content: "string",
  filename: "string",
} as const;

export const parsedProjectSchema = {
  files: "array",
} as const;

export type ParsedProjectFile = Readonly<{
  content: string;
  filename: string;
}>;

export type ParsedProject = Readonly<{
  files: readonly ParsedProjectFile[];
}>;

const requireContent = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new HttpError(ErrorCode.ParamsError, "Generated content cannot be empty");
  }
  return trimmed;
};

const extractFencedCode = (
  content: string,
  languageNames: readonly string[],
): string | undefined => {
  const normalizedNames = new Set(languageNames.map((name) => name.toLowerCase()));
  for (const block of extractMarkdownCodeBlocks(content)) {
    if (normalizedNames.has(block.language.toLowerCase())) return block.body.trim();
  }
  return undefined;
};

const parseVanillaHtml = (content: string): ParsedProject => ({
  files: [
    {
      content: extractFencedCode(content, ["html"]) ?? requireContent(content),
      filename: "index.html",
    },
  ],
});

const parseMultiFiles = (content: string): ParsedProject => {
  const html = extractFencedCode(content, ["html"]);
  if (html === undefined) {
    throw new HttpError(ErrorCode.ParamsError, "HTML code block is required");
  }
  return {
    files: [
      { content: html, filename: "index.html" },
      {
        content: extractFencedCode(content, ["css"]) ?? "",
        filename: "index.css",
      },
      {
        content: extractFencedCode(content, ["js", "javascript"]) ?? "",
        filename: "index.js",
      },
    ],
  };
};

export const parseGeneratedCode = (content: string, codegenType: CodegenType): ParsedProject => {
  switch (codegenType) {
    case CodegenType.VANILLA_HTML:
      return parseVanillaHtml(content);
    case CodegenType.MULTI_FILES:
      return parseMultiFiles(content);
  }
};
