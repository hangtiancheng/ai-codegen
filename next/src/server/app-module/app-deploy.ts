import type { AppModel } from "@/generated/prisma/models/App";
import { ErrorCode, HttpError } from "../common/index";
import { type DeploymentService, generateUniqueDeployKey } from "../deployment/index";
import { generateDeployKey } from "./app.constants";
import type { AppRepository } from "./app-repository";

export const createUniqueAppDeployKey = (appRepository: AppRepository): Promise<string> =>
  generateUniqueDeployKey(
    {
      exists: async (key) => (await appRepository.findActiveByDeployKey(key)) != null,
    },
    generateDeployKey,
  );

export const createDeployAppOperation =
  (
    appRepository: AppRepository,
    requireOwnedApp: (id: bigint, userId: bigint) => Promise<AppModel>,
    deploymentService?: DeploymentService,
  ) =>
  async (appId: bigint, userId: bigint): Promise<string> => {
    if (deploymentService === undefined) {
      throw new HttpError(ErrorCode.SystemError, "Deployment service is not configured", 500);
    }
    const app = await requireOwnedApp(appId, userId);
    const deployKey = app.deployKey ?? (await createUniqueAppDeployKey(appRepository));
    const deployed = await deploymentService.deployArtifacts({
      app,
      deployKey,
    });
    await appRepository.updateById(app.id, {
      deployKey: deployed.deployKey,
      deployTime: new Date(),
    });
    return deployed.deployUrl;
  };
