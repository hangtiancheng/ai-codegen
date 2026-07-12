import { join, resolve } from "node:path";
import type { AppModel } from "../generated/prisma/models/App.js";
import { buildCodeOutputDir } from "../project/index.js";
import { copyDirectoryFresh } from "./file-copy.js";
import type { ScreenshotJob } from "./screenshot-service.js";

export type DeploymentConfig = Readonly<{
  deployHost: string;
  rootDir?: string;
}>;

export type DeployAppResult = Readonly<{
  deployDir: string;
  deployKey: string;
  deployUrl: string;
}>;

export type DeploymentService = Readonly<{
  deployArtifacts: (input: { app: AppModel; deployKey: string }) => Promise<DeployAppResult>;
}>;

const buildDeployUrl = (deployHost: string, deployKey: string): string =>
  `${deployHost.replace(/\/$/u, "")}/dist/${deployKey}/index.html`;

export const createDeploymentService = (
  config: DeploymentConfig,
  screenshotJob: ScreenshotJob,
): DeploymentService => {
  const rootDir = config.rootDir ?? process.cwd();
  const deployRootDir = resolve(rootDir, "tmp", "code_deploy");

  const deployArtifacts = async (input: {
    app: AppModel;
    deployKey: string;
  }): Promise<DeployAppResult> => {
    const codeOutputDir = buildCodeOutputDir(
      rootDir,
      input.app.codegenType,
      input.app.id.toString(),
    );
    const deployDir = join(deployRootDir, input.deployKey);
    await copyDirectoryFresh(codeOutputDir, deployDir);
    const deployUrl = buildDeployUrl(config.deployHost, input.deployKey);
    screenshotJob.enqueue({ app: input.app, deployUrl }).catch(() => undefined);
    return { deployDir, deployKey: input.deployKey, deployUrl };
  };

  return { deployArtifacts };
};
