import { tool } from "@langchain/core/tools";
import {
  deleteProjectFile,
  modifyProjectFile,
  readProjectDir,
  readProjectFile,
  writeProjectFile,
} from "./file-operations";
import {
  dirReadInputSchema,
  exitInputSchema,
  fileDeleteInputSchema,
  fileModifyInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
} from "./file-tool-schemas";

export const createFileWriteTool = (workDir: string) =>
  tool(
    (input: { content: string; filepath: string }) =>
      writeProjectFile(workDir, input.filepath, input.content),
    {
      description: "Write content to a relative file path.",
      name: "FileWrite",
      schema: fileWriteInputSchema,
    },
  );

export const createFileReadTool = (workDir: string) =>
  tool(
    (input: { filePath: string }) => readProjectFile(workDir, input.filePath),
    {
      description: "Read content from a relative file path.",
      name: "FileRead",
      schema: fileReadInputSchema,
    },
  );

export const createFileModifyTool = (workDir: string) =>
  tool(
    (input: { filePath: string; replaceStr: string; searchStr: string }) =>
      modifyProjectFile(
        workDir,
        input.filePath,
        input.searchStr,
        input.replaceStr,
      ),
    {
      description:
        "Modify a file by replacing the first matching search string.",
      name: "FileModify",
      schema: fileModifyInputSchema,
    },
  );

export const createFileDeleteTool = (workDir: string) =>
  tool(
    (input: { filePath: string }) => deleteProjectFile(workDir, input.filePath),
    {
      description: "Delete a non-protected file at a relative path.",
      name: "FileDelete",
      schema: fileDeleteInputSchema,
    },
  );

export const createDirReadTool = (workDir: string) =>
  tool(
    (input: { dirPath?: string | undefined }) =>
      readProjectDir(workDir, input.dirPath),
    {
      description: "Read the directory tree below a relative path.",
      name: "ReadDir",
      schema: dirReadInputSchema,
    },
  );

export const createExitTool = () =>
  tool(
    (input: { reason?: string | undefined }) =>
      Promise.resolve(input.reason ?? "Task completed"),
    {
      description: "Signal that the coding task is complete.",
      name: "Exit",
      schema: exitInputSchema,
    },
  );

export const createProjectFileTools = (workDir: string) => [
  createFileWriteTool(workDir),
  createFileReadTool(workDir),
  createFileModifyTool(workDir),
  createFileDeleteTool(workDir),
  createDirReadTool(workDir),
  createExitTool(),
];
