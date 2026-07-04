import { z } from "zod";

export const runtimeEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default("http://localhost:3000/api"),
  VITE_DEPLOY_DOMAIN: z.string().url().default("http://localhost:3000/api/dist"),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function parseRuntimeEnv(source: Readonly<Record<string, unknown>>): RuntimeEnv {
  return runtimeEnvSchema.parse(source);
}
