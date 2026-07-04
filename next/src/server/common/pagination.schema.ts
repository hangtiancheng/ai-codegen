import { z } from "zod";

export const sortOrderSchema = z.enum(["ascend", "descend"]);

export const pageRequestSchema = z.object({
  current: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(20).default(10),
  sortField: z.string().min(1).max(64).optional(),
  sortOrder: sortOrderSchema.optional(),
});

export type PageRequest = z.infer<typeof pageRequestSchema>;

export const toOffset = (request: PageRequest) => ({
  skip: (request.current - 1) * request.pageSize,
  take: request.pageSize,
});
