import {
  buildAiModelRegistryConfigFromEnv,
  createAiModelRegistry,
  createLangChainCodegenRouter,
} from "../ai/index.js";
import { env } from "../config/index.js";
import type { AppCodegenRouter } from "./app-service.js";

export const createDefaultCodegenRouter = (): AppCodegenRouter =>
  createLangChainCodegenRouter(createAiModelRegistry(buildAiModelRegistryConfigFromEnv(env)));
