import type { AppPageQuery } from "./app.schema";
import type { AppListFilter } from "./app-repository";

export const buildAppListFilter = (query: AppPageQuery): AppListFilter => ({
  ...(query.id !== undefined && { id: query.id }),
  ...(query.appName !== undefined && { appName: query.appName }),
  ...(query.codegenType !== undefined && { codegenType: query.codegenType }),
  ...(query.deployKey !== undefined && { deployKey: query.deployKey }),
  ...(query.initPrompt !== undefined && { initPrompt: query.initPrompt }),
  ...(query.priority !== undefined && { priority: query.priority }),
  ...(query.userId !== undefined && { userId: query.userId }),
});
