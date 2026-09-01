import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelConfig } from "../models/model-config.schema.js";
import { createOpenAIChatModel } from "./openai-factory.js";

export const createChatModel = (config: ModelConfig): BaseChatModel => {
  const { provider } = config;
  return createOpenAIChatModel(provider, config);
};

export type ChatModelFactory = typeof createChatModel;
