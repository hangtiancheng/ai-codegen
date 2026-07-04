import { spawn } from "node:child_process";

export type CutoverCommand = Readonly<{
  args: readonly string[];
  command: string;
  name: string;
  required: boolean;
}>;

export type CutoverCommandResult = Readonly<{
  command: CutoverCommand;
  exitCode: number;
  ok: boolean;
  stderr: string;
  stdout: string;
}>;

export const runCutoverCommand = (
  command: CutoverCommand,
  cwd: string,
): Promise<CutoverCommandResult> =>
  new Promise((resolve) => {
    const child = spawn(command.command, [...command.args], {
      cwd,
      env: process.env,
      shell: false,
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => stdout.push(chunk));
    child.stderr.on("data", (chunk: string) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({
        command,
        exitCode: 1,
        ok: false,
        stderr: error.message,
        stdout: stdout.join(""),
      });
    });
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      resolve({
        command,
        exitCode,
        ok: exitCode === 0,
        stderr: stderr.join(""),
        stdout: stdout.join(""),
      });
    });
  });
