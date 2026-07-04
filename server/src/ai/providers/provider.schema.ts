import { z } from "zod";

export const ollamaProviderSchema = z.object({
  baseUrl: z.string().min(1).default("http://localhost:11434"),
  kind: z.literal("ollama"),
});

export const providerSchema = ollamaProviderSchema;

export type OllamaProvider = z.infer<typeof ollamaProviderSchema>;
export type Provider = z.infer<typeof providerSchema>;
