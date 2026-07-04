import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  type CutoverCommand,
  type CutoverCommandResult,
  runCutoverCommand,
} from "./command-runner";

const cutoverEvidenceEnvSchema = z.object({
  CUTOVER_EVIDENCE_DIR: z.string().min(1).default("tmp/cutover-evidence"),
});

export type CutoverEvidenceSummary = Readonly<{
  generatedAt: string;
  ok: boolean;
  requiredFailures: readonly string[];
  results: readonly CutoverCommandResult[];
}>;

const commands = [
  { args: ["prisma:validate"], command: "pnpm", name: "prisma-validate", required: true },
  { args: ["build"], command: "pnpm", name: "build", required: true },
  { args: ["test"], command: "pnpm", name: "test", required: true },
  { args: ["check:ci"], command: "pnpm", name: "check-ci", required: true },
  { args: ["test:coverage"], command: "pnpm", name: "coverage", required: true },
  { args: ["audit", "--prod"], command: "pnpm", name: "audit-prod", required: false },
  { args: ["licenses", "list", "--prod"], command: "pnpm", name: "licenses-prod", required: false },
] as const satisfies readonly CutoverCommand[];

export const summarizeCutoverEvidence = (
  results: readonly CutoverCommandResult[],
  generatedAt: string,
): CutoverEvidenceSummary => {
  const requiredFailures = results
    .filter((result) => result.command.required && !result.ok)
    .map((result) => result.command.name);
  return {
    generatedAt,
    ok: requiredFailures.length === 0,
    requiredFailures,
    results,
  };
};

const writeEvidenceFiles = async (
  outputDir: string,
  summary: CutoverEvidenceSummary,
): Promise<void> => {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  for (const result of summary.results) {
    const basePath = join(outputDir, result.command.name);
    await writeFile(`${basePath}.stdout.txt`, result.stdout);
    await writeFile(`${basePath}.stderr.txt`, result.stderr);
  }
};

export const collectCutoverEvidence = async (
  cwd: string,
  now: () => Date = () => new Date(),
): Promise<CutoverEvidenceSummary> => {
  const env = cutoverEvidenceEnvSchema.parse(process.env);
  const results: CutoverCommandResult[] = [];
  for (const command of commands) {
    results.push(await runCutoverCommand(command, cwd));
  }
  const summary = summarizeCutoverEvidence(results, now().toISOString());
  await writeEvidenceFiles(env.CUTOVER_EVIDENCE_DIR, summary);
  return summary;
};
