import type { AiEnv } from "../../config/ai-env.schema.js";
import type { ModelConfig } from "../models/model-config.schema.js";
import type { Provider } from "../providers/provider.schema.js";

type ProviderKind = AiEnv["AI_ROUTE_PROVIDER"];

export const buildProvider = (kind: ProviderKind, env: AiEnv): Provider => {
  switch (kind) {
    case "ollama":
      return { baseUrl: env.OLLAMA_BASE_URL, kind: "ollama" };
  }
};

type RoleEnv = Readonly<{
  maxTokens: number;
  modelName: string;
  providerKind: ProviderKind;
  streaming: boolean;
  temperature: number;
}>;

export const toModelConfig = (env: AiEnv, role: RoleEnv): ModelConfig => ({
  maxTokens: role.maxTokens,
  modelName: role.modelName,
  provider: buildProvider(role.providerKind, env),
  streaming: role.streaming,
  temperature: role.temperature,
});
