import { afterEach, describe, expect, it, vi } from "vitest";
import { reportRuntimeIssue } from "./release-logger";

describe("reportRuntimeIssue", () => {
  const errorSpy = vi.spyOn(globalThis.console, "error");

  afterEach(() => {
    errorSpy.mockReset();
  });

  it("writes structured release-safety diagnostics without external SDKs", () => {
    errorSpy.mockImplementationOnce(() => undefined);

    reportRuntimeIssue({
      kind: "deploy-failure",
      message: "Deploy failed",
      context: { appId: 10 },
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "[release-safety]",
      expect.objectContaining({
        kind: "deploy-failure",
        message: "Deploy failed",
        context: { appId: 10 },
      }),
    );
  });
});
