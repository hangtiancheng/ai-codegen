import { z } from "zod";

const providerKindSchema = z.literal("openai");

const numericEnv = z.coerce.number().int().min(1);
const tempEnv = z.coerce.number().min(0).max(2);

export const aiEnvSchema = z.object({
  QUALITY_MAX_TOKENS: numericEnv.default(4096),
  QUALITY_MODEL: z.string().min(1).default("qwen2.5"),
  QUALITY_PROVIDER: providerKindSchema.default("openai"),
  QUALITY_TEMPERATURE: tempEnv.default(0.2),
  REASONING_MAX_TOKENS: numericEnv.default(8192),
  REASONING_MODEL: z.string().min(1).default("qwen2.5"),
  REASONING_PROVIDER: providerKindSchema.default("openai"),
  REASONING_TEMPERATURE: tempEnv.default(0.1),
  ROUTE_MAX_TOKENS: numericEnv.default(100),
  ROUTE_MODEL: z.string().min(1).default("qwen2.5"),
  ROUTE_PROVIDER: providerKindSchema.default("openai"),
  ROUTE_TEMPERATURE: tempEnv.default(0),
  STREAMING_MAX_TOKENS: numericEnv.default(8192),
  STREAMING_MODEL: z.string().min(1).default("qwen3.5"),
  STREAMING_PROVIDER: providerKindSchema.default("openai"),
  STREAMING_TEMPERATURE: tempEnv.default(0.2),
  OPENAI_BASE_URL: z.string().min(1).default("http://localhost:11434"),
  STORAGE_DRIVER: z.enum(["local", "minio"]).default("local"),
  STORAGE_LOCAL_PUBLIC_BASE_URL: z
    .string()
    .min(1)
    .default("http://localhost:3000/storage"),
  STORAGE_LOCAL_ROOT_DIR: z.string().min(1).default("tmp/storage"),
  STORAGE_MINIO_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_MINIO_BUCKET: z.string().min(1).default("swifty-codegen"),
  STORAGE_MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  STORAGE_MINIO_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  STORAGE_MINIO_PUBLIC_BASE_URL: z
    .string()
    .min(1)
    .default("http://localhost:9000/swifty-codegen"),
  STORAGE_MINIO_REGION: z.string().min(1).optional(),
  STORAGE_MINIO_SECRET_KEY: z.string().min(1).optional(),
  STORAGE_MINIO_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;
