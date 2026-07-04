import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import type { ModelConfig } from "../models/model-config.schema";
import type { OllamaProvider } from "./provider.schema";

export const createOllamaChatModel = (
  provider: OllamaProvider,
  config: ModelConfig,
): BaseChatModel =>
  new ChatOllama({
    baseUrl: provider.baseUrl,
    model: config.modelName,
    streaming: config.streaming,
    numPredict: config.maxTokens,
    temperature: config.temperature,
  });
