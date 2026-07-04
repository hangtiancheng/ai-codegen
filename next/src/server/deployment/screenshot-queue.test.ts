import { describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { buildApp } from "../test-support/index";
import {
  createQueuedScreenshotJob,
  createScreenshotQueueProcessor,
  type ScreenshotQueuePayload,
} from "./screenshot-queue";

describe("screenshot queue", () => {
  it("enqueues serializable screenshot payloads with retry options", async () => {
    const payloads: ScreenshotQueuePayload[] = [];
    const job = createQueuedScreenshotJob({
      add: async (_name, payload) => {
        payloads.push(payload);
      },
    });

    await job.enqueue({
      app: buildApp({ codegenType: CodegenType.VITE_PROJECT, id: 9n }),
      deployUrl: "http://localhost:3000/api/dist/key/index.html",
    });

    expect(payloads).toEqual([
      {
        appId: "9",
        codegenType: CodegenType.VITE_PROJECT,
        deployUrl: "http://localhost:3000/api/dist/key/index.html",
      },
    ]);
  });

  it("processes queued payloads through the screenshot job", async () => {
    const processed: ScreenshotQueuePayload[] = [];
    const processor = createScreenshotQueueProcessor({
      enqueue: async (input) => {
        processed.push({
          appId: input.app.id.toString(),
          codegenType: input.app.codegenType,
          deployUrl: input.deployUrl,
        });
      },
    });

    await processor.process({
      appId: "9",
      codegenType: CodegenType.VANILLA_HTML,
      deployUrl: "http://localhost:3000/api/dist/key/index.html",
    });

    expect(processed).toEqual([
      {
        appId: "9",
        codegenType: CodegenType.VANILLA_HTML,
        deployUrl: "http://localhost:3000/api/dist/key/index.html",
      },
    ]);
  });
});
