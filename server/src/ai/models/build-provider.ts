import type { AiEnv } from "../../config/ai.schema.js";
import type { ModelConfig } from "../models/model-config.schema.js";
import type { Provider } from "../providers/provider.schema.js";

type ProviderKind = AiEnv["ROUTE_PROVIDER"];

export const buildProvider = (kind: ProviderKind, env: AiEnv): Provider => {
  switch (kind) {
    case "openai":
      return { baseUrl: env.OPENAI_BASE_URL, kind: "openai" };
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
