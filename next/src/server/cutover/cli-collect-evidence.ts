import { collectCutoverEvidence } from "./cutover-evidence";

const summary = await collectCutoverEvidence(process.cwd());

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) {
  process.exitCode = 1;
}
