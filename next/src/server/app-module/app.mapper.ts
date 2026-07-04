import type { AppModel } from "@/generated/prisma/models/App";
import type { AppVo } from "./app.schema";

export const toAppVo = (entity: AppModel): AppVo => ({
  appCover: entity.appCover,
  appName: entity.appName,
  codegenType: entity.codegenType,
  createTime: entity.createTime,
  deployKey: entity.deployKey,
  deployTime: entity.deployTime,
  id: entity.id.toString(),
  initPrompt: entity.initPrompt,
  priority: entity.priority,
  updateTime: entity.updateTime,
  userId: entity.userId.toString(),
});
