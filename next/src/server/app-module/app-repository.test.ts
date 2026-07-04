import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { CodegenType } from "@/generated/prisma/enums";
import type { PrismaDatabaseClient } from "../database/index";
import { buildApp } from "../test-support/index";
import { createAppRepository } from "./app-repository";

describe("createAppRepository", () => {
  it("findActiveById excludes deleted apps", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    const fixture = buildApp();
    db.app.findFirst.mockResolvedValue(fixture);

    const repo = createAppRepository(db);
    await repo.findActiveById(7n);

    expect(db.app.findFirst).toHaveBeenCalledWith({
      where: { id: 7n, isDelete: false },
    });
  });

  it("findActiveByDeployKey looks up by deployKey", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.app.findFirst.mockResolvedValue(buildApp({ deployKey: "abc" }));
    const repo = createAppRepository(db);

    await repo.findActiveByDeployKey("abc");

    expect(db.app.findFirst).toHaveBeenCalledWith({
      where: { deployKey: "abc", isDelete: false },
    });
  });

  it("createApp persists provided codegenType and userId", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.app.create.mockResolvedValue(buildApp());
    const repo = createAppRepository(db);

    await repo.createApp({
      appName: "portfolio",
      codegenType: CodegenType.VITE_PROJECT,
      initPrompt: "build a portfolio",
      userId: 1n,
    });

    expect(db.app.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appName: "portfolio",
        codegenType: CodegenType.VITE_PROJECT,
        initPrompt: "build a portfolio",
        userId: 1n,
      }),
    });
  });
});
