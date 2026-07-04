import { join, resolve } from "node:path";
import { ErrorCode, HttpError } from "../common/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import type { AppModel } from "../generated/prisma/models/App.js";
import type { BuildProjectResult, CommandRunner } from "../project/index.js";
import { buildCodeOutputDir, buildViteProject } from "../project/index.js";
import type { ViteCodegenLogger, ViteCodegenLogSession } from "../workflow/index.js";
import { copyDirectoryFresh } from "./file-copy.js";
import type { ScreenshotJob } from "./screenshot-service.js";
import { logViteDeployBuild, logViteDeployCopy } from "./vite-deployment-log-events.js";

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

type Builder = (projectDir: string, runner?: CommandRunner) => Promise<BuildProjectResult>;

const buildDeployUrl = (deployHost: string, deployKey: string): string =>
  `${deployHost.replace(/\/$/u, "")}/dist/${deployKey}/index.html`;

const createDeployLogSession = (
  logger: ViteCodegenLogger | undefined,
  input: Readonly<{ app: AppModel; deployKey: string }>,
): Promise<ViteCodegenLogSession | undefined> => {
  if (logger === undefined) return Promise.resolve(undefined);
  return logger.createSession({
    appId: input.app.id.toString(),
    deployKey: input.deployKey,
    operation: "deploy",
    userId: input.app.userId.toString(),
  });
};

export const createDeploymentService = (
  config: DeploymentConfig,
  screenshotJob: ScreenshotJob,
  builder: Builder = buildViteProject,
  viteProjectLogger?: ViteCodegenLogger,
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
    if (input.app.codegenType === CodegenType.VITE_PROJECT) {
      const viteLog = await createDeployLogSession(viteProjectLogger, input);
      await viteLog?.info({
        details: { codeOutputDir, deployDir, deployKey: input.deployKey },
        message: "Vite project deploy started",
        stage: "start",
      });
      const build = await builder(codeOutputDir);
      if (viteLog !== undefined) await logViteDeployBuild(viteLog, build);
      if (!build.success) {
        await viteLog?.info({
          message: "Vite project deploy stopped because build failed",
          stage: "error",
        });
        throw new HttpError(ErrorCode.OperationError, "Failed to build project", 500);
      }
      const distDir = join(codeOutputDir, "dist");
      await viteLog?.info({
        details: { deployDir, sourceDir: distDir },
        message: "Vite dist copy started",
        stage: "copy-dist",
      });
      await copyDirectoryFresh(distDir, deployDir);
      if (viteLog !== undefined) {
        await logViteDeployCopy(viteLog, { deployDir, sourceDir: distDir });
      }
      await viteLog?.info({
        message: "Screenshot capture job enqueued",
        stage: "screenshot",
      });
      const deployUrl = buildDeployUrl(config.deployHost, input.deployKey);
      screenshotJob.enqueue({ app: input.app, deployUrl }).catch(() => undefined);
      await viteLog?.info({
        details: { deployDir, deployUrl },
        message: "Vite project deploy completed",
        stage: "complete",
      });
      return { deployDir, deployKey: input.deployKey, deployUrl };
    } else {
      await copyDirectoryFresh(codeOutputDir, deployDir);
    }
    const deployUrl = buildDeployUrl(config.deployHost, input.deployKey);
    screenshotJob.enqueue({ app: input.app, deployUrl }).catch(() => undefined);
    return { deployDir, deployKey: input.deployKey, deployUrl };
  };

  return { deployArtifacts };
};
