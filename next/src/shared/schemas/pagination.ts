import { z } from "zod";
import { nonNegativeIntSchema, positiveIntSchema } from "./primitives";

type Page<TRecord extends z.ZodTypeAny> = Readonly<{
  records: ReadonlyArray<z.infer<TRecord>>;
  pageNumber: number;
  pageSize: number;
  totalPage: number;
  totalRow: number;
}>;

export function pageSchema<TRecord extends z.ZodTypeAny>(
  record: TRecord,
): z.ZodType<Page<TRecord>> {
  const currentPageSchema = z.object({
    records: z.array(record),
    pageNumber: positiveIntSchema,
    pageSize: positiveIntSchema,
    totalPage: nonNegativeIntSchema,
    totalRow: nonNegativeIntSchema,
  });
  const backendPageSchema = z
    .object({
      records: z.array(record),
      total: nonNegativeIntSchema,
    })
    .transform(({ records, total }) => ({
      records,
      pageNumber: 1,
      pageSize: Math.max(records.length, 1),
      totalPage: total > 0 ? 1 : 0,
      totalRow: total,
    }));
  return z.union([currentPageSchema, backendPageSchema]);
}

export const paginationQuerySchema = z.object({
  pageNum: positiveIntSchema.default(1),
  pageSize: positiveIntSchema.default(10),
  sortField: z.string().optional(),
  sortOrder: z.enum(["ascend", "descend"]).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
