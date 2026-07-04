import type { Browser, LaunchOptions, Page } from "puppeteer-core";
import type { ScreenshotCapturer } from "./screenshot-service.js";

export type BrowserScreenshotViewport = Readonly<{
  height: number;
  width: number;
}>;

export type BrowserScreenshotLauncher = Readonly<{
  launch: (options: LaunchOptions) => Promise<Browser>;
}>;

export type BrowserScreenshotCapturerConfig = Readonly<{
  executablePath?: string;
  launcher?: BrowserScreenshotLauncher;
  launchArgs?: readonly string[];
  timeoutMs?: number;
  viewport?: BrowserScreenshotViewport;
}>;

const defaultLaunchArgs = ["--no-sandbox", "--disable-setuid-sandbox"] as const;
const defaultTimeoutMs = 30_000;
const defaultViewport: BrowserScreenshotViewport = { height: 720, width: 1280 };

const loadDefaultLauncher = async (): Promise<BrowserScreenshotLauncher> => {
  const puppeteer = await import("puppeteer-core");
  return puppeteer.default;
};

const buildLaunchOptions = (config: BrowserScreenshotCapturerConfig): LaunchOptions => {
  const viewport = config.viewport ?? defaultViewport;
  const launchArgs = config.launchArgs ?? defaultLaunchArgs;
  const executable =
    config.executablePath === undefined ? {} : { executablePath: config.executablePath };

  return {
    ...executable,
    args: [...launchArgs],
    defaultViewport: {
      height: viewport.height,
      width: viewport.width,
    },
    headless: true,
  };
};

const closePage = async (page: Page | undefined): Promise<void> => {
  if (page === undefined) return;
  await page.close();
};

export const createBrowserScreenshotCapturer = (
  config: BrowserScreenshotCapturerConfig = {},
): ScreenshotCapturer => ({
  capture: async (input) => {
    const launcher = config.launcher ?? (await loadDefaultLauncher());
    const browser = await launcher.launch(buildLaunchOptions(config));
    let page: Page | undefined;

    try {
      page = await browser.newPage();
      const timeout = config.timeoutMs ?? defaultTimeoutMs;
      await page.goto(input.deployUrl, {
        timeout,
        waitUntil: "networkidle0",
      });
      const screenshot = await page.screenshot({
        fullPage: true,
        type: "png",
      });
      return Buffer.from(screenshot);
    } finally {
      await closePage(page);
      await browser.close();
    }
  },
});
