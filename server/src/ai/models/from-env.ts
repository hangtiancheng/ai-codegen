import type { AiEnv } from "../../config/ai.schema.js";
import { toModelConfig } from "./build-provider.js";
import type { AiModelRegistryConfig } from "./model-config.schema.js";

export const buildAiModelRegistryConfigFromEnv = (
  env: AiEnv,
): AiModelRegistryConfig => ({
  quality: toModelConfig(env, {
    maxTokens: env.QUALITY_MAX_TOKENS,
    modelName: env.QUALITY_MODEL,
    providerKind: env.QUALITY_PROVIDER,
    streaming: false,
    temperature: env.QUALITY_TEMPERATURE,
  }),
  reasoning: toModelConfig(env, {
    maxTokens: env.REASONING_MAX_TOKENS,
    modelName: env.REASONING_MODEL,
    providerKind: env.REASONING_PROVIDER,
    streaming: true,
    temperature: env.REASONING_TEMPERATURE,
  }),
  route: toModelConfig(env, {
    maxTokens: env.ROUTE_MAX_TOKENS,
    modelName: env.ROUTE_MODEL,
    providerKind: env.ROUTE_PROVIDER,
    streaming: false,
    temperature: env.ROUTE_TEMPERATURE,
  }),
  streaming: toModelConfig(env, {
    maxTokens: env.STREAMING_MAX_TOKENS,
    modelName: env.STREAMING_MODEL,
    providerKind: env.STREAMING_PROVIDER,
    streaming: true,
    temperature: env.STREAMING_TEMPERATURE,
  }),
});
