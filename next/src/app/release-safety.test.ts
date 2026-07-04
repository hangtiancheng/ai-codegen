import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runtimeEnvSchema } from "@/shared/schemas";

const packageSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

describe("release safety", () => {
  it("does not ship the swifty sentry package", () => {
    const packageJson = readJson(join(process.cwd(), "package.json"));
    const parsed = packageSchema.parse(packageJson);

    expect(parsed.dependencies?.["@swifty.js/sentry"]).toBeUndefined();
    expect(parsed.devDependencies?.["@swifty.js/sentry"]).toBeUndefined();
  });

  it("keeps runtime configuration limited to supported release variables", () => {
    const parsed = runtimeEnvSchema.parse({
      VITE_API_BASE_URL: "https://example.test/api",
      VITE_DEPLOY_DOMAIN: "https://deploy.example.test",
      VITE_SENTRY_DSN: "https://example.test/sentry",
    });

    expect("VITE_SENTRY_DSN" in parsed).toBe(false);
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
