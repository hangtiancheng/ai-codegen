import { describe, expect, it } from "vitest";
import { describeViteOutputCompletenessIssue } from "./vite-output-completeness";
import { isQualityPassed } from "./workflow-ai";

describe("quality result parsing", () => {
  it("uses explicit percentage scores when passed is omitted", () => {
    expect(isQualityPassed('{"score": 95, "issues": []}')).toBe(true);
    expect(isQualityPassed('{"score": 59, "issues": ["needs work"]}')).toBe(false);
  });

  it("requires percentage integer scores", () => {
    expect(() => isQualityPassed('{"passed": true, "score": 9.8, "issues": []}')).toThrow();
  });

  it("respects an explicit passed flag", () => {
    expect(isQualityPassed('{"passed": true, "score": 60, "issues": []}')).toBe(true);
    expect(isQualityPassed('{"passed": false, "score": 95, "issues": []}')).toBe(false);
  });
});

describe("Vite output completeness", () => {
  it("detects an unterminated fenced code block", () => {
    expect(
      describeViteOutputCompletenessIssue(
        '```json\n{"filepath":"./src/App.tsx","content":"export default',
      ),
    ).toBe("Generated Vite project output contains an unterminated fenced code block");
  });

  it("accepts balanced fenced code blocks", () => {
    expect(
      describeViteOutputCompletenessIssue(
        '```json\n{"filepath":"./src/App.tsx","content":"export default function App(){}"}\n```',
      ),
    ).toBeUndefined();
  });
});
