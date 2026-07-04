import type { AppRepository } from "../app-module/index.js";
import type { AppModel } from "../generated/prisma/models/App.js";
import type { MetricsService } from "../observability/index.js";
import type { StorageAdapter } from "./storage-adapter.js";

export type ScreenshotAppInfo = Readonly<Pick<AppModel, "codegenType" | "id">>;

export type ScreenshotCaptureInput = Readonly<{
  app: ScreenshotAppInfo;
  deployUrl: string;
}>;

export type ScreenshotCapturer = Readonly<{
  capture: (input: ScreenshotCaptureInput) => Promise<Buffer>;
}>;

export type ScreenshotJob = Readonly<{
  enqueue: (input: ScreenshotCaptureInput) => Promise<void>;
}>;

export const createNoopScreenshotCapturer = (): ScreenshotCapturer => ({
  capture: async () => Buffer.from(""),
});

export const createScreenshotJob = (
  capturer: ScreenshotCapturer,
  storage: StorageAdapter,
  appRepository: AppRepository,
  metricsService?: MetricsService,
): ScreenshotJob => ({
  enqueue: async (input) => {
    try {
      const screenshot = await capturer.capture(input);
      if (screenshot.length === 0) return;
      const appCover = await storage.putObject({
        contentType: "image/png",
        key: `screenshots/${input.app.codegenType}_${input.app.id.toString()}.png`,
        value: screenshot,
      });
      await appRepository.updateById(input.app.id, { appCover });
    } catch {
      metricsService?.recordScreenshotFailure({ source: "direct" });
      return;
    }
  },
});
