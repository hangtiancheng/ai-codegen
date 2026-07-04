import { getDeployUrl } from "@/shared/config";
import type { AppVo, UserId } from "@/shared/schemas";

export function openDeployedApp(app: AppVo): void {
  if (app.deployKey === undefined || app.deployKey === null) {
    return;
  }
  window.open(getDeployUrl(app.deployKey), "_blank", "noopener,noreferrer");
}

export function canManageApp(app: AppVo, userId: UserId | undefined): boolean {
  if (userId === undefined) {
    return false;
  }
  return app.userId === userId;
}
