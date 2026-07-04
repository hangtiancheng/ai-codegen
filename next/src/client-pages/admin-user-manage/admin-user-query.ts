import {
  type UserQueryRequest,
  type UserRole,
  userIdSchema,
  userQueryRequestSchema,
} from "@/shared/schemas";
import { optionalPositiveInteger, optionalTrimmed } from "../admin-shared/filter-value";

export const adminUserPageSize = 10;

export type AdminUserFilterValues = {
  readonly id: string;
  readonly userAccount: string;
  readonly username: string;
  readonly userRole: UserRole | "";
};

export const initialAdminUserFilters: AdminUserFilterValues = {
  id: "",
  userAccount: "",
  username: "",
  userRole: "",
};

export function buildAdminUserQuery(
  filters: AdminUserFilterValues,
  pageNum: number,
): UserQueryRequest {
  const id = optionalPositiveInteger(filters.id);
  return userQueryRequestSchema.parse({
    pageNum,
    pageSize: adminUserPageSize,
    sortField: "createTime",
    sortOrder: "descend",
    id: id === undefined ? undefined : userIdSchema.parse(id),
    userAccount: optionalTrimmed(filters.userAccount),
    username: optionalTrimmed(filters.username),
    userRole: filters.userRole === "" ? undefined : filters.userRole,
  });
}
