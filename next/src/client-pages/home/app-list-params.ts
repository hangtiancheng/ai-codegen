import { appQueryRequestSchema } from "@/shared/schemas";

export const homeAppListParams = appQueryRequestSchema.parse({
  pageNum: 1,
  pageSize: 6,
  sortField: "createTime",
  sortOrder: "descend",
});
