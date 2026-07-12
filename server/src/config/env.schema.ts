import { z } from "zod";
import { aiEnvSchema } from "./ai-env.schema.js";

const baseEnvSchema = z.object({
  API_PREFIX: z
    .string()
    .regex(/^[a-z0-9][a-z0-9/-]*$/u)
    .default("api"),
  AI_PROMPT_MAX_LENGTH: z.coerce.number().int().min(1).max(50_000).default(4096),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .default("*")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.url().optional(),
  HEALTH_MODEL_PROBE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  HEALTH_MODEL_TIMEOUT_MS: z.coerce.number().int().min(500).default(5_000),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PASSWORD_SALT: z.string().min(1).default("swifty"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  RATE_LIMIT_AI_GENERATION_MAX: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_AI_GENERATION_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
  REDIS_URL: z.url().optional(),
  REQUEST_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(1024 * 1024),
  SESSION_SECRET: z.string().min(16).default("server-v2-default-secret-change-me"),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .default(60 * 60 * 24 * 7),
});

export const envSchema = baseEnvSchema.extend(aiEnvSchema.shape).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;
  if (value.CORS_ALLOWED_ORIGINS.includes("*")) {
    ctx.addIssue({
      code: "custom",
      message: "CORS_ALLOWED_ORIGINS must not include wildcard origins in production",
      path: ["CORS_ALLOWED_ORIGINS"],
    });
  }
  if (value.PASSWORD_SALT === "swifty") {
    ctx.addIssue({
      code: "custom",
      message: "PASSWORD_SALT must be overridden in production",
      path: ["PASSWORD_SALT"],
    });
  }
  if (value.SESSION_SECRET === "server-v2-default-secret-change-me") {
    ctx.addIssue({
      code: "custom",
      message: "SESSION_SECRET must be overridden in production",
      path: ["SESSION_SECRET"],
    });
  }
  if (value.REDIS_URL === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "REDIS_URL must be configured in production",
      path: ["REDIS_URL"],
    });
  }
  if (value.STORAGE_DRIVER === "local") {
    ctx.addIssue({
      code: "custom",
      message: "STORAGE_DRIVER must not use local storage in production",
      path: ["STORAGE_DRIVER"],
    });
  }
  if (value.STORAGE_MINIO_ACCESS_KEY === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "STORAGE_MINIO_ACCESS_KEY must be configured in production",
      path: ["STORAGE_MINIO_ACCESS_KEY"],
    });
  }
  if (value.STORAGE_MINIO_SECRET_KEY === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "STORAGE_MINIO_SECRET_KEY must be configured in production",
      path: ["STORAGE_MINIO_SECRET_KEY"],
    });
  }
});

export type Env = z.infer<typeof envSchema>;
