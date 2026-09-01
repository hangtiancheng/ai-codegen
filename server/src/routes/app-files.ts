import type { AppService } from "../app-module/index.js";
import { buildAppFileTree } from "../codegen-agent/index.js";
import { buildCodeOutputDir } from "../project/index.js";

export type AppFilesDeps = Readonly<{
  appService: AppService;
  projectRootDir?: string;
}>;

export const loadAppFileTree = async (deps: AppFilesDeps, appId: bigint) => {
  const app = await deps.appService.requireActiveById(appId);
  const projectDir = buildCodeOutputDir(deps.projectRootDir ?? process.cwd(), app.id.toString());
  return buildAppFileTree(projectDir);
};
