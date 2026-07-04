import { describe, expect, it } from "vitest";
import { envSchema } from "./env.schema";

const productionEnv = {
  CORS_ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com",
  NODE_ENV: "production",
  PASSWORD_SALT: "production-password-salt",
  REDIS_URL: "redis://localhost:6379",
  SCREENSHOT_BROWSER_EXECUTABLE_PATH: "/usr/bin/chromium",
  SESSION_SECRET: "production-session-secret-value",
  STORAGE_DRIVER: "minio",
  STORAGE_MINIO_ACCESS_KEY: "minio-access-key",
  STORAGE_MINIO_SECRET_KEY: "minio-secret-key",
};

describe("environment schema security policy", () => {
  it("parses configured CORS origin allowlists", () => {
    const env = envSchema.parse(productionEnv);

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("rejects wildcard CORS origins in production", () => {
    expect(() =>
      envSchema.parse({
        ...productionEnv,
        CORS_ALLOWED_ORIGINS: "*",
      }),
    ).toThrow("CORS_ALLOWED_ORIGINS");
  });

  it("rejects insecure production secrets", () => {
    expect(() =>
      envSchema.parse({
        ...productionEnv,
        PASSWORD_SALT: "swifty",
        SESSION_SECRET: "server-v2-default-secret-change-me",
      }),
    ).toThrow("PASSWORD_SALT");
  });

  it("rejects development-only production adapters", () => {
    expect(() =>
      envSchema.parse({
        ...productionEnv,
        REDIS_URL: undefined,
        SCREENSHOT_BROWSER_EXECUTABLE_PATH: undefined,
        STORAGE_DRIVER: "local",
      }),
    ).toThrow("REDIS_URL");
  });
});
