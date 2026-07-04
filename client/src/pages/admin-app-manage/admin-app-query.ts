import {
  appIdSchema,
  appQueryRequestSchema,
  userIdSchema,
  type AppQueryRequest,
  type CodegenType,
} from "@/shared/schemas";
import {
  optionalPositiveInteger,
  optionalTrimmed,
} from "../admin-shared/filter-value";

export const adminAppPageSize = 10;

export type AdminAppFilterValues = {
  readonly id: string;
  readonly appName: string;
  readonly userId: string;
  readonly codegenType: CodegenType | "";
};

export const initialAdminAppFilters: AdminAppFilterValues = {
  id: "",
  appName: "",
  userId: "",
  codegenType: "",
};

export function buildAdminAppQuery(
  filters: AdminAppFilterValues,
  pageNum: number,
): AppQueryRequest {
  const id = optionalPositiveInteger(filters.id);
  const userId = optionalPositiveInteger(filters.userId);
  return appQueryRequestSchema.parse({
    pageNum,
    pageSize: adminAppPageSize,
    sortField: "createTime",
    sortOrder: "descend",
    id: id === undefined ? undefined : appIdSchema.parse(id),
    appName: optionalTrimmed(filters.appName),
    userId: userId === undefined ? undefined : userIdSchema.parse(userId),
    codegenType: filters.codegenType === "" ? undefined : filters.codegenType,
  });
}
