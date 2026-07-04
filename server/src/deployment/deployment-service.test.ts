import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodegenType } from "../generated/prisma/enums.js";
import { buildApp } from "../test-support/index.js";
import { createFileViteCodegenLogger } from "../workflow/index.js";
import { createDeploymentService } from "./deployment-service.js";
import type { ScreenshotJob } from "./screenshot-service.js";

const tempDirs: string[] = [];

const createRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "swifty-codegen-deploy-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

const createFailingScreenshotJob = (): ScreenshotJob => ({
  enqueue: async () => {
    throw new Error("screenshot failed");
  },
});

describe("deployment service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies non-Vite project output to deploy directory and returns dist URL", async () => {
    const root = await createRoot();
    const app = buildApp({ codegenType: CodegenType.MULTI_FILES, id: 7n });
    const outputDir = join(root, "tmp", "code_output", "MULTI_FILES_7");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "index.html"), "<html></html>", "utf-8");

    const service = createDeploymentService(
      { deployHost: "http://localhost:3000/api", rootDir: root },
      createFailingScreenshotJob(),
    );
    const result = await service.deployArtifacts({ app, deployKey: "abc123" });

    expect(result.deployUrl).toBe(
      "http://localhost:3000/api/dist/abc123/index.html",
    );
    await expect(
      readFile(
        join(root, "tmp", "code_deploy", "abc123", "index.html"),
        "utf-8",
      ),
    ).resolves.toBe("<html></html>");
  });

  it("builds Vite output and deploys the dist directory only", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const root = await createRoot();
    const app = buildApp({ codegenType: CodegenType.VITE_PROJECT, id: 8n });
    const outputDir = join(root, "tmp", "code_output", "VITE_PROJECT_8");
    await mkdir(join(outputDir, "dist"), { recursive: true });
    await writeFile(join(outputDir, "index.html"), "source", "utf-8");
    await writeFile(join(outputDir, "dist", "index.html"), "built", "utf-8");
    const service = createDeploymentService(
      { deployHost: "http://localhost:3000/api/", rootDir: root },
      createFailingScreenshotJob(),
      async () => ({ logs: "built", success: true }),
      createFileViteCodegenLogger(join(root, "logs")),
    );

    await service.deployArtifacts({ app, deployKey: "vite12" });

    await expect(
      readFile(
        join(root, "tmp", "code_deploy", "vite12", "index.html"),
        "utf-8",
      ),
    ).resolves.toBe("built");
    const [sessionDirName] = await readdir(join(root, "logs"));
    if (sessionDirName === undefined)
      throw new Error("Expected a deploy log directory");
    const sessionDir = join(root, "logs", sessionDirName);
    await expect(
      readFile(join(sessionDir, "deploy-build.log"), "utf-8"),
    ).resolves.toBe("built");
    await expect(
      readFile(join(sessionDir, "copy-dist.json"), "utf-8"),
    ).resolves.toContain("code_deploy");
    await expect(
      readFile(join(sessionDir, "events.ndjson"), "utf-8"),
    ).resolves.toContain('"operation":"deploy"');
  });

  it("returns a typed business error when Vite build fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const root = await createRoot();
    const app = buildApp({ codegenType: CodegenType.VITE_PROJECT, id: 9n });
    await mkdir(join(root, "tmp", "code_output", "VITE_PROJECT_9"), {
      recursive: true,
    });
    const service = createDeploymentService(
      { deployHost: "http://localhost:3000/api", rootDir: root },
      createFailingScreenshotJob(),
      async () => ({ logs: "failed", success: false }),
      createFileViteCodegenLogger(join(root, "logs")),
    );

    await expect(
      service.deployArtifacts({ app, deployKey: "fail99" }),
    ).rejects.toMatchObject({
      code: 50001,
    });
    const [sessionDirName] = await readdir(join(root, "logs"));
    if (sessionDirName === undefined)
      throw new Error("Expected a deploy log directory");
    const sessionDir = join(root, "logs", sessionDirName);
    await expect(
      readFile(join(sessionDir, "deploy-build.log"), "utf-8"),
    ).resolves.toBe("failed");
    await expect(
      readFile(join(sessionDir, "events.ndjson"), "utf-8"),
    ).resolves.toContain("deploy stopped because build failed");
  });
});
