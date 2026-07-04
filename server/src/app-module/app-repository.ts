import type { PrismaDatabaseClient } from "../database/index.js";
import type { CodegenType } from "../generated/prisma/enums.js";
import type { SortableAppField } from "./app-sorting.js";

type CreateAppInput = Readonly<{
  appName: string;
  codegenType: CodegenType;
  deployKey?: string;
  initPrompt: string;
  userId: bigint;
}>;

type UpdateAppInput = Readonly<{
  appCover?: string;
  appName?: string;
  codegenType?: CodegenType;
  deployKey?: string;
  deployTime?: Date;
  priority?: number;
}>;

export type AppListFilter = Readonly<{
  appName?: string;
  codegenType?: CodegenType;
  deployKey?: string;
  id?: bigint;
  initPrompt?: string;
  priority?: number;
  userId?: bigint;
}>;

export type ListAppParams = Readonly<{
  filter: AppListFilter;
  skip: number;
  sort: { field: SortableAppField; order: "asc" | "desc" };
  take: number;
}>;

const buildCreateData = (data: CreateAppInput) => ({
  appName: data.appName,
  codegenType: data.codegenType,
  initPrompt: data.initPrompt,
  userId: data.userId,
  ...(data.deployKey !== undefined && { deployKey: data.deployKey }),
});

const buildUpdateData = (data: UpdateAppInput) => ({
  ...(data.appCover !== undefined && { appCover: data.appCover }),
  ...(data.appName !== undefined && { appName: data.appName }),
  ...(data.codegenType !== undefined && { codegenType: data.codegenType }),
  ...(data.deployKey !== undefined && { deployKey: data.deployKey }),
  ...(data.deployTime !== undefined && { deployTime: data.deployTime }),
  ...(data.priority !== undefined && { priority: data.priority }),
});

const buildListWhere = (filter: AppListFilter) => ({
  isDelete: false,
  ...(filter.id !== undefined && { id: filter.id }),
  ...(filter.codegenType !== undefined && { codegenType: filter.codegenType }),
  ...(filter.deployKey !== undefined && { deployKey: filter.deployKey }),
  ...(filter.priority !== undefined && { priority: filter.priority }),
  ...(filter.userId !== undefined && { userId: filter.userId }),
  ...(filter.appName !== undefined && { appName: { contains: filter.appName } }),
  ...(filter.initPrompt !== undefined && {
    initPrompt: { contains: filter.initPrompt },
  }),
});

export const createAppRepository = (db: PrismaDatabaseClient) => ({
  countActive: (filter: AppListFilter) => db.app.count({ where: buildListWhere(filter) }),

  createApp: (data: CreateAppInput) => db.app.create({ data: buildCreateData(data) }),

  findActiveByDeployKey: (deployKey: string) =>
    db.app.findFirst({ where: { deployKey, isDelete: false } }),

  findActiveById: (id: bigint) => db.app.findFirst({ where: { id, isDelete: false } }),

  listActive: (params: ListAppParams) =>
    db.app.findMany({
      orderBy: { [params.sort.field]: params.sort.order },
      skip: params.skip,
      take: params.take,
      where: buildListWhere(params.filter),
    }),

  softDeleteById: (id: bigint) => db.app.update({ data: { isDelete: true }, where: { id } }),

  updateById: (id: bigint, data: UpdateAppInput) =>
    db.app.update({ data: buildUpdateData(data), where: { id } }),
});

export type AppRepository = ReturnType<typeof createAppRepository>;
