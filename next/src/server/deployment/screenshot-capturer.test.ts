import type { Browser, LaunchOptions, Page } from "puppeteer-core";
import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import {
  type BrowserScreenshotLauncher,
  createBrowserScreenshotCapturer,
} from "./screenshot-capturer";

const createFixture = () => {
  const page = mockDeep<Page>();
  const browser = mockDeep<Browser>();
  browser.newPage.mockResolvedValue(page);
  page.screenshot.mockResolvedValue(new Uint8Array([1, 2, 3]));
  const launch = vi.fn<(options: LaunchOptions) => Promise<Browser>>(async () => browser);
  const launcher: BrowserScreenshotLauncher = { launch };
  return { browser, launch, launcher, page };
};

describe("browser screenshot capturer", () => {
  it("captures deployed pages with configured browser options", async () => {
    const fixture = createFixture();
    const capturer = createBrowserScreenshotCapturer({
      executablePath: "/usr/bin/chromium",
      launcher: fixture.launcher,
      timeoutMs: 5_000,
      viewport: { height: 600, width: 900 },
    });

    const screenshot = await capturer.capture({
      app: { codegenType: "VITE_PROJECT", id: 10n },
      deployUrl: "http://localhost:3000/api/dist/key/index.html",
    });

    expect(screenshot).toEqual(Buffer.from([1, 2, 3]));
    expect(fixture.launch).toHaveBeenCalledWith({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { height: 600, width: 900 },
      executablePath: "/usr/bin/chromium",
      headless: true,
    });
    expect(fixture.page.goto).toHaveBeenCalledWith(
      "http://localhost:3000/api/dist/key/index.html",
      {
        timeout: 5_000,
        waitUntil: "networkidle0",
      },
    );
    expect(fixture.page.screenshot).toHaveBeenCalledWith({
      fullPage: true,
      type: "png",
    });
    expect(fixture.page.close).toHaveBeenCalledTimes(1);
    expect(fixture.browser.close).toHaveBeenCalledTimes(1);
  });

  it("closes browser resources when capture fails", async () => {
    const fixture = createFixture();
    fixture.page.screenshot.mockRejectedValue(new Error("capture failed"));
    const capturer = createBrowserScreenshotCapturer({
      launcher: fixture.launcher,
    });

    await expect(
      capturer.capture({
        app: { codegenType: "MULTI_FILES", id: 11n },
        deployUrl: "http://localhost:3000/api/dist/key/index.html",
      }),
    ).rejects.toThrow("capture failed");

    expect(fixture.page.close).toHaveBeenCalledTimes(1);
    expect(fixture.browser.close).toHaveBeenCalledTimes(1);
  });
});
