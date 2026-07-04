import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "../common/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import { buildCodeOutputDir } from "../project/index.js";
import { buildApp, buildUser } from "../test-support/index.js";
import {
  buildHarness,
  createStaticWorkflow,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils.js";

const tempDirs: string[] = [];

const createProjectFixture = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "migration-smoke-"));
  tempDirs.push(rootDir);
  const projectDir = buildCodeOutputDir(rootDir, CodegenType.VITE_PROJECT, "9");
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "index.html"), "<html></html>");
  return rootDir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("migration smoke flow", () => {
  it("exercises health, auth, app creation, generation, deploy, and download", async () => {
    const projectRootDir = await createProjectFixture();
    const harness = buildHarness({
      codegenWorkflow: createStaticWorkflow(["generated"]),
      projectRootDir,
    });
    const user = buildUser({
      id: 7n,
      userAccount: "smoke-user",
      userPassword: hashPassword("password123"),
    });
    harness.db.user.findFirst.mockResolvedValueOnce(user);
    const health = await harness.app.request("/api/health");
    const cookie = await loginAndGetCookie(harness.app, "smoke-user", "password123");
    harness.db.app.findFirst.mockResolvedValueOnce(null);
    harness.db.app.create.mockResolvedValueOnce(buildApp({ id: 9n, userId: 7n }));
    const created = await jsonRequest(
      harness.app,
      "/api/app/add",
      { initPrompt: "build a vite app" },
      cookie,
    );
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VITE_PROJECT, id: 9n, userId: 7n }),
    );
    const generated = await harness.app.request("/api/app/chat/codegen?appId=9&message=build", {
      headers: { Cookie: cookie },
    });
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ deployKey: "abc123", id: 9n, userId: 7n }),
    );
    harness.db.app.update.mockResolvedValueOnce(buildApp({ id: 9n, userId: 7n }));
    const deployed = await jsonRequest(harness.app, "/api/app/deploy", { appId: "9" }, cookie);
    harness.db.app.findFirst.mockResolvedValueOnce(
      buildApp({ codegenType: CodegenType.VITE_PROJECT, id: 9n, userId: 7n }),
    );
    const downloaded = await harness.app.request("/api/app/download/9", {
      headers: { Cookie: cookie },
    });
    const bytes = new Uint8Array(await downloaded.arrayBuffer());

    expect(health.status).toBe(200);
    expect((await parseBody(created)).data).toBe("9");
    expect(generated.status).toBe(200);
    expect((await parseBody(deployed)).data).toBe(
      "http://localhost:3000/api/dist/abc123/index.html",
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toContain("application/zip");
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0)).toBe("PK");
  });
});
