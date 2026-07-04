import { toAppVo } from "./app.mapper";
import type { AppPageQuery, AppVo } from "./app.schema";
import { buildAppListFilter } from "./app-filter";
import type { AppListFilter, AppRepository } from "./app-repository";
import { resolveAppSortField } from "./app-sorting";

export const createListAppVoByPageOperation =
  (appRepository: AppRepository) =>
  async (
    query: AppPageQuery,
    overrides: AppListFilter = {},
  ): Promise<{ records: AppVo[]; total: number }> => {
    const filter: AppListFilter = {
      ...buildAppListFilter(query),
      ...overrides,
    };
    const [apps, total] = await Promise.all([
      appRepository.listActive({
        filter,
        skip: (query.current - 1) * query.pageSize,
        sort: {
          field: resolveAppSortField(query.sortField),
          order: query.sortOrder === "ascend" ? "asc" : "desc",
        },
        take: query.pageSize,
      }),
      appRepository.countActive(filter),
    ]);
    return { records: apps.map(toAppVo), total };
  };
