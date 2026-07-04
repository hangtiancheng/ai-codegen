import { ErrorCode, HttpError } from "../common/index.js";
import type { DeploymentService } from "../deployment/index.js";
import type { AppModel } from "../generated/prisma/models/App.js";
import { AWESOME_APP_PRIORITY } from "./app.constants.js";
import { toAppVo } from "./app.mapper.js";
import type {
  AppAddRequest,
  AppAdminUpdateRequest,
  AppPageQuery,
  AppUpdateRequest,
  AppVo,
} from "./app.schema.js";
import { createDeployAppOperation, createUniqueAppDeployKey } from "./app-deploy.js";
import { createListAppVoByPageOperation } from "./app-list.js";
import { requireOwner } from "./app-owner.js";
import type { AppRepository } from "./app-repository.js";

export type AppCodegenRouter = Readonly<{
  routeCodegenType: (initPrompt: string) => Promise<AppModel["codegenType"]>;
}>;

export const createAppService = (
  appRepository: AppRepository,
  codegenRouter: AppCodegenRouter,
  deploymentService?: DeploymentService,
) => {
  const requireActiveById = async (id: bigint): Promise<AppModel> => {
    const app = await appRepository.findActiveById(id);
    if (app === null) {
      throw new HttpError(ErrorCode.NotFoundError, "App not found", 404);
    }
    return app;
  };

  const addApp = async (input: AppAddRequest, userId: bigint): Promise<string> => {
    const codegenType = await codegenRouter.routeCodegenType(input.initPrompt);
    const deployKey = await createUniqueAppDeployKey(appRepository);
    const created = await appRepository.createApp({
      appName: String(Date.now()),
      codegenType,
      deployKey,
      initPrompt: input.initPrompt,
      userId,
    });
    return created.id.toString();
  };

  const updateApp = async (input: AppUpdateRequest, userId: bigint): Promise<boolean> => {
    const app = await requireActiveById(input.id);
    requireOwner(app, userId);
    await appRepository.updateById(input.id, {
      ...(input.appName !== undefined && { appName: input.appName }),
    });
    return true;
  };

  const deleteApp = async (id: bigint, userId: bigint): Promise<boolean> => {
    const app = await requireActiveById(id);
    requireOwner(app, userId);
    await appRepository.softDeleteById(id);
    return true;
  };

  const adminDeleteApp = async (id: bigint): Promise<boolean> => {
    await requireActiveById(id);
    await appRepository.softDeleteById(id);
    return true;
  };

  const adminUpdateApp = async (input: AppAdminUpdateRequest): Promise<boolean> => {
    await requireActiveById(input.id);
    await appRepository.updateById(input.id, {
      ...(input.appCover !== undefined && { appCover: input.appCover }),
      ...(input.appName !== undefined && { appName: input.appName }),
      ...(input.codegenType !== undefined && {
        codegenType: input.codegenType,
      }),
      ...(input.priority !== undefined && { priority: input.priority }),
    });
    return true;
  };

  const getAppVoById = async (id: bigint): Promise<AppVo> => toAppVo(await requireActiveById(id));

  const requireOwnedApp = async (id: bigint, userId: bigint): Promise<AppModel> => {
    const app = await requireActiveById(id);
    requireOwner(app, userId);
    return app;
  };

  const listAppVoByPage = createListAppVoByPageOperation(appRepository);

  const myListAppVoByPage = (query: AppPageQuery, userId: bigint) =>
    listAppVoByPage(query, { userId });

  const awesomeListAppVoByPage = (query: AppPageQuery) =>
    listAppVoByPage(query, { priority: AWESOME_APP_PRIORITY });

  const adminListAppVoByPage = (query: AppPageQuery) => listAppVoByPage(query);

  const deployApp = createDeployAppOperation(appRepository, requireOwnedApp, deploymentService);

  return {
    addApp,
    adminDeleteApp,
    adminListAppVoByPage,
    adminUpdateApp,
    awesomeListAppVoByPage,
    deleteApp,
    deployApp,
    getAppVoById,
    myListAppVoByPage,
    requireActiveById,
    requireOwnedApp,
    updateApp,
  };
};

export type AppService = ReturnType<typeof createAppService>;
