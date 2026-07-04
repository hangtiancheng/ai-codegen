import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { CodegenType } from "@/generated/prisma/enums";
import type { AppCodegenRouter } from "../../app-module/app-service";
import { ErrorCode, HttpError } from "../../common/index";
import type { AiModelRegistry } from "../models/index";
import { ROUTE_SYSTEM_PROMPT } from "../prompts/index";

const routeClassificationSchema = z
  .object({
    codegenType: z.enum(CodegenType),
  })
  .strict();

const modelResponseSchema = z.object({
  content: z.string(),
});

const fencedJsonPattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/u;

export type RouteMessages = readonly [SystemMessage, HumanMessage];

export type RouteModelInvoker = Readonly<{
  invoke: (messages: RouteMessages) => Promise<unknown>;
}>;

const parseRouteClassification = (content: string): CodegenType => {
  const normalizedContent = normalizeRouteContent(content);
  const parsedJson: unknown = JSON.parse(normalizedContent);
  return routeClassificationSchema.parse(parsedJson).codegenType;
};

const normalizeRouteContent = (content: string): string => {
  const trimmed = content.trim();
  const match = fencedJsonPattern.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
};

export const createCodegenTypeRouter = (model: RouteModelInvoker): AppCodegenRouter => ({
  routeCodegenType: async (initPrompt) => {
    const response = await model.invoke([
      new SystemMessage(ROUTE_SYSTEM_PROMPT),
      new HumanMessage(initPrompt),
    ]);
    const content = modelResponseSchema.parse(response).content.trim();
    try {
      return parseRouteClassification(content);
    } catch {
      throw new HttpError(
        ErrorCode.OperationError,
        "Model returned an invalid code generation route",
        500,
      );
    }
  },
});

export const createLangChainCodegenRouter = (registry: AiModelRegistry): AppCodegenRouter => {
  const model = registry.createModel("route");
  return createCodegenTypeRouter({
    invoke: async (messages) => model.invoke([...messages]),
  });
};
