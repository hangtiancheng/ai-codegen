import {
  buildAiModelRegistryConfigFromEnv,
  createAiModelRegistry,
  createLangChainCodegenRouter,
} from "../ai/index";
import { env } from "../config/index";
import type { AppCodegenRouter } from "./app-service";

export const createDefaultCodegenRouter = (): AppCodegenRouter =>
  createLangChainCodegenRouter(createAiModelRegistry(buildAiModelRegistryConfigFromEnv(env)));
