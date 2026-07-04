import { z } from "zod";

const providerKindSchema = z.literal("ollama");

const numericEnv = z.coerce.number().int().min(1);
const tempEnv = z.coerce.number().min(0).max(2);

export const aiEnvSchema = z.object({
  AI_QUALITY_MAX_TOKENS: numericEnv.default(4096),
  AI_QUALITY_MODEL: z.string().min(1).default("qwen2.5"),
  AI_QUALITY_PROVIDER: providerKindSchema.default("ollama"),
  AI_QUALITY_TEMPERATURE: tempEnv.default(0.2),
  AI_REASONING_MAX_TOKENS: numericEnv.default(8192),
  AI_REASONING_MODEL: z.string().min(1).default("qwen2.5"),
  AI_REASONING_PROVIDER: providerKindSchema.default("ollama"),
  AI_REASONING_TEMPERATURE: tempEnv.default(0.1),
  AI_ROUTE_MAX_TOKENS: numericEnv.default(100),
  AI_ROUTE_MODEL: z.string().min(1).default("qwen2.5"),
  AI_ROUTE_PROVIDER: providerKindSchema.default("ollama"),
  AI_ROUTE_TEMPERATURE: tempEnv.default(0),
  AI_STREAMING_MAX_TOKENS: numericEnv.default(8192),
  AI_STREAMING_MODEL: z.string().min(1).default("qwen3.5"),
  AI_STREAMING_PROVIDER: providerKindSchema.default("ollama"),
  AI_STREAMING_TEMPERATURE: tempEnv.default(0.2),
  CODEGEN_DEPLOY_HOST: z.string().min(1).default("http://localhost:3000/api"),
  OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
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
