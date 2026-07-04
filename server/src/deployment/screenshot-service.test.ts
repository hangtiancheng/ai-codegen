import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { AppRepository } from "../app-module/index.js";
import { buildApp } from "../test-support/index.js";
import { createScreenshotJob } from "./screenshot-service.js";
import type { StorageAdapter } from "./storage-adapter.js";

describe("screenshot job", () => {
  it("uploads screenshots and updates app cover", async () => {
    const repository = mockDeep<AppRepository>();
    const storage: StorageAdapter = {
      putObject: async () => "http://cdn/screenshot.png",
    };
    const job = createScreenshotJob(
      { capture: async () => Buffer.from("png") },
      storage,
      repository,
    );

    await job.enqueue({
      app: buildApp({ id: 12n }),
      deployUrl: "http://localhost:3000/api/dist/key/index.html",
    });

    expect(repository.updateById).toHaveBeenCalledWith(12n, {
      appCover: "http://cdn/screenshot.png",
    });
  });

  it("swallows screenshot failures", async () => {
    const repository = mockDeep<AppRepository>();
    const storage: StorageAdapter = {
      putObject: async () => "never",
    };
    const job = createScreenshotJob(
      {
        capture: async () => {
          throw new Error("capture failed");
        },
      },
      storage,
      repository,
    );

    await expect(
      job.enqueue({
        app: buildApp({ id: 12n }),
        deployUrl: "http://localhost:3000/api/dist/key/index.html",
      }),
    ).resolves.toBeUndefined();
    expect(repository.updateById).not.toHaveBeenCalled();
  });
});
