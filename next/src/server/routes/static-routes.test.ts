import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { buildHarness } from "./user-routes-utils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("static dist routes", () => {
  it("serves deployed static files from /api/dist/:deployKey", async () => {
    const root = await mkdtemp(join(tmpdir(), "swifty-codegen-static-route-"));
    tempDirs.push(root);
    const deployRoot = join(root, "deploy");
    await mkdir(join(deployRoot, "abc123", "assets"), { recursive: true });
    await writeFile(
      join(deployRoot, "abc123", "index.html"),
      "<html></html>",
      "utf-8",
    );
    await writeFile(
      join(deployRoot, "abc123", "assets", "app.js"),
      "alert(1)",
      "utf-8",
    );
    const harness = buildHarness();
    const app = createApp({
      ...harness.deps,
      staticDeployRootDir: deployRoot,
    });

    const response = await app.request("/api/dist/abc123/index.html");
    const assetResponse = await app.request("/api/dist/abc123/assets/app.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toBe("<html></html>");
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "text/javascript",
    );
    await expect(assetResponse.text()).resolves.toBe("alert(1)");
  });

  it("serves generated preview files from /api/static/:outputKey", async () => {
    const root = await mkdtemp(join(tmpdir(), "swifty-codegen-preview-route-"));
    tempDirs.push(root);
    const outputRoot = join(root, "output");
    await mkdir(join(outputRoot, "VITE_PROJECT_9", "assets"), {
      recursive: true,
    });
    await writeFile(
      join(outputRoot, "VITE_PROJECT_9", "index.html"),
      "<html></html>",
      "utf-8",
    );
    await writeFile(
      join(outputRoot, "VITE_PROJECT_9", "assets", "app.js"),
      "alert(1)",
      "utf-8",
    );
    const harness = buildHarness();
    const app = createApp({
      ...harness.deps,
      staticOutputRootDir: outputRoot,
    });

    const indexResponse = await app.request("/api/static/VITE_PROJECT_9/");
    const assetResponse = await app.request(
      "/api/static/VITE_PROJECT_9/assets/app.js",
    );

    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("content-type")).toContain("text/html");
    await expect(indexResponse.text()).resolves.toBe("<html></html>");
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "text/javascript",
    );
  });

  it("redirects extensionless generated preview roots to trailing slash urls", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "swifty-codegen-preview-canonical-"),
    );
    tempDirs.push(root);
    const outputRoot = join(root, "output");
    await mkdir(join(outputRoot, "MULTI_FILES_6"), { recursive: true });
    await writeFile(
      join(outputRoot, "MULTI_FILES_6", "index.html"),
      "<html></html>",
      "utf-8",
    );
    const harness = buildHarness();
    const app = createApp({
      ...harness.deps,
      staticOutputRootDir: outputRoot,
    });

    const response = await app.request("/api/static/MULTI_FILES_6?v=3");

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "/api/static/MULTI_FILES_6/?v=3",
    );
  });

  it("serves generated preview files with canonical frontend output keys", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "swifty-codegen-preview-canonical-"),
    );
    tempDirs.push(root);
    const outputRoot = join(root, "output");
    await mkdir(join(outputRoot, "MULTI_FILES_6"), { recursive: true });
    await writeFile(
      join(outputRoot, "MULTI_FILES_6", "index.html"),
      "<html></html>",
      "utf-8",
    );
    const harness = buildHarness();
    const app = createApp({
      ...harness.deps,
      staticOutputRootDir: outputRoot,
    });

    const response = await app.request("/api/static/MULTI_FILES_6/?v=3");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toBe("<html></html>");
  });

  it("rejects traversal attempts for generated preview files", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "swifty-codegen-preview-traversal-"),
    );
    tempDirs.push(root);
    const outputRoot = join(root, "output");
    await mkdir(join(outputRoot, "VITE_PROJECT_9"), { recursive: true });
    const harness = buildHarness();
    const app = createApp({
      ...harness.deps,
      staticOutputRootDir: outputRoot,
    });

    const response = await app.request(
      "/api/static/VITE_PROJECT_9/%2e%2e/secret.txt",
    );

    expect(response.status).not.toBe(200);
  });
});
