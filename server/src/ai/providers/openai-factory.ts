import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import type { ModelConfig } from "../models/model-config.schema.js";
import type { OpenAIProvider } from "./provider.schema.js";

export const createOpenAIChatModel = (
  provider: OpenAIProvider,
  config: ModelConfig,
): BaseChatModel =>
  new ChatOpenAI({
    model: config.modelName,
    streaming: config.streaming,
    temperature: config.temperature,
  });
