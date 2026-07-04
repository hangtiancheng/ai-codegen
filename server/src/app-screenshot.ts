import { env } from "./config/index.js";
import { createBrowserScreenshotCapturer, type ScreenshotCapturer } from "./deployment/index.js";

export const createDefaultScreenshotCapturer = (): ScreenshotCapturer => {
  const config = {
    timeoutMs: env.SCREENSHOT_TIMEOUT_MS,
    viewport: {
      height: env.SCREENSHOT_VIEWPORT_HEIGHT,
      width: env.SCREENSHOT_VIEWPORT_WIDTH,
    },
  };
  if (env.SCREENSHOT_BROWSER_EXECUTABLE_PATH === undefined) {
    return createBrowserScreenshotCapturer(config);
  }
  return createBrowserScreenshotCapturer({
    ...config,
    executablePath: env.SCREENSHOT_BROWSER_EXECUTABLE_PATH,
  });
};
