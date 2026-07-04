import { describe, expect, it } from "vitest";
import { parseRuntimeEnv, runtimeEnvSchema } from "./runtime-env";

describe("runtimeEnvSchema", () => {
  it("applies defaults when source is empty", () => {
    const value = runtimeEnvSchema.parse({});
    expect(value.VITE_API_BASE_URL).toMatch(/^http/);
    expect(value.VITE_DEPLOY_DOMAIN).toMatch(/^http/);
  });

  it("rejects malformed urls", () => {
    const result = runtimeEnvSchema.safeParse({
      VITE_API_BASE_URL: "not a url",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseRuntimeEnv", () => {
  it("returns parsed values", () => {
    const value = parseRuntimeEnv({
      VITE_API_BASE_URL: "https://example.test/api",
    });
    expect(value.VITE_API_BASE_URL).toBe("https://example.test/api");
  });
});
