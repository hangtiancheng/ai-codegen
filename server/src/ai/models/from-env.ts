import type { AiEnv } from "../../config/ai-env.schema.js";
import { toModelConfig } from "./build-provider.js";
import type { AiModelRegistryConfig } from "./model-config.schema.js";

export const buildAiModelRegistryConfigFromEnv = (env: AiEnv): AiModelRegistryConfig => ({
  quality: toModelConfig(env, {
    maxTokens: env.AI_QUALITY_MAX_TOKENS,
    modelName: env.AI_QUALITY_MODEL,
    providerKind: env.AI_QUALITY_PROVIDER,
    streaming: false,
    temperature: env.AI_QUALITY_TEMPERATURE,
  }),
  reasoning: toModelConfig(env, {
    maxTokens: env.AI_REASONING_MAX_TOKENS,
    modelName: env.AI_REASONING_MODEL,
    providerKind: env.AI_REASONING_PROVIDER,
    streaming: true,
    temperature: env.AI_REASONING_TEMPERATURE,
  }),
  route: toModelConfig(env, {
    maxTokens: env.AI_ROUTE_MAX_TOKENS,
    modelName: env.AI_ROUTE_MODEL,
    providerKind: env.AI_ROUTE_PROVIDER,
    streaming: false,
    temperature: env.AI_ROUTE_TEMPERATURE,
  }),
  streaming: toModelConfig(env, {
    maxTokens: env.AI_STREAMING_MAX_TOKENS,
    modelName: env.AI_STREAMING_MODEL,
    providerKind: env.AI_STREAMING_PROVIDER,
    streaming: true,
    temperature: env.AI_STREAMING_TEMPERATURE,
  }),
});
