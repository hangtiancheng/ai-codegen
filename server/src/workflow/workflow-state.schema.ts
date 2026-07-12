import { z } from "zod";
import { CodegenType } from "../generated/prisma/enums.js";
import { imageCollectionPlanSchema, imageResourceListSchema } from "./image-assets.schema.js";

export const workflowStateSchema = z.object({
  appId: z.bigint(),
  codegenType: z.enum(CodegenType),
  enhancedPrompt: z.string(),
  error: z.string().default(""),
  generatedCode: z.string().default(""),
  imageCollectionPlan: imageCollectionPlanSchema.optional(),
  imageResources: imageResourceListSchema.default([]),
  outputDir: z.string().optional(),
  qualityCheckMessage: z.string().default(""),
  qualityCheckPassed: z.boolean().default(false),
  userId: z.bigint(),
  userPrompt: z.string(),
});

export type WorkflowState = z.infer<typeof workflowStateSchema>;

export const createInitialWorkflowState = (input: {
  appId: bigint;
  codegenType: CodegenType;
  userId: bigint;
  userPrompt: string;
}): WorkflowState =>
  workflowStateSchema.parse({
    appId: input.appId,
    codegenType: input.codegenType,
    enhancedPrompt: input.userPrompt,
    userId: input.userId,
    userPrompt: input.userPrompt,
  });
