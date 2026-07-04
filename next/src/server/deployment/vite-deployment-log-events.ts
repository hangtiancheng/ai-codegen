import type { BuildProjectResult } from "../project/index";
import type { ViteCodegenLogSession } from "../workflow/index";

export const logViteDeployBuild = async (
  session: ViteCodegenLogSession,
  build: BuildProjectResult,
): Promise<void> => {
  await session.writeArtifact("deploy-build.log", build.logs);
  await session.info({
    details: { success: build.success },
    message: "Vite deploy build completed",
    stage: "project-build",
  });
};

export const logViteDeployCopy = async (
  session: ViteCodegenLogSession,
  input: Readonly<{ deployDir: string; sourceDir: string }>,
): Promise<void> => {
  await session.writeArtifact("copy-dist.json", JSON.stringify(input, null, 2));
  await session.info({
    details: input,
    message: "Vite dist directory copied to deploy directory",
    stage: "copy-dist",
  });
};
