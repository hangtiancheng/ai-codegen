import { z } from "zod";

export const openaiProviderSchema = z.object({
  baseUrl: z.string().min(1).default("http://localhost:11434"),
  kind: z.literal("openai"),
});

export const providerSchema = openaiProviderSchema;

export type OpenAIProvider = z.infer<typeof openaiProviderSchema>;
export type Provider = z.infer<typeof providerSchema>;
