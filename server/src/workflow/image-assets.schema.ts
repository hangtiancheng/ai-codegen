import { z } from "zod";

export const imageCategorySchema = z.enum(["ARCHITECTURE", "CONTENT", "ILLUSTRATION", "LOGO"]);

const queryTaskSchema = z.object({
  query: z.string().min(1).max(256),
});

export const imageCollectionPlanSchema = z.object({
  contentImageTasks: z.array(queryTaskSchema).default([]),
  diagramTasks: z
    .array(
      z.object({
        description: z.string().min(1).max(512),
        mermaidCode: z.string().min(1).max(10_000),
      }),
    )
    .default([]),
  illustrationTasks: z.array(queryTaskSchema).default([]),
  logoTasks: z
    .array(
      z.object({
        description: z.string().min(1).max(512),
      }),
    )
    .default([]),
});

export const imageResourceSchema = z.object({
  category: imageCategorySchema,
  description: z.string().min(1).max(512),
  url: z.url(),
});

export const imageResourceListSchema = z.array(imageResourceSchema).max(64);

export type ImageCategory = z.infer<typeof imageCategorySchema>;
export type ImageCollectionPlan = z.infer<typeof imageCollectionPlanSchema>;
export type ImageResource = z.infer<typeof imageResourceSchema>;
