import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiException } from "./api-error";
import {
  clearUnauthorizedRedirectHandler,
  isUnauthorizedException,
  notifyUnauthorized,
  setUnauthorizedRedirectHandler,
  unauthorizedCode,
} from "./unauthorized-handler";

describe("unauthorized-handler", () => {
  afterEach(() => {
    clearUnauthorizedRedirectHandler();
  });

  it("invokes the registered handler with the current url", () => {
    const handler = vi.fn();
    setUnauthorizedRedirectHandler(handler);
    notifyUnauthorized("https://api.example/api/thing");
    expect(handler).toHaveBeenCalledWith("https://api.example/api/thing");
  });

  it("does nothing when no handler is registered", () => {
    expect(() => notifyUnauthorized("https://api/thing")).not.toThrow();
  });

  it("isUnauthorizedException narrows ApiException with unauthorized kind", () => {
    const exception = new ApiException({
      kind: "unauthorized",
      code: unauthorizedCode,
      message: "x",
    });
    expect(isUnauthorizedException(exception)).toBe(true);
    expect(isUnauthorizedException(new ApiException({ kind: "network", message: "x" }))).toBe(
      false,
    );
    expect(isUnauthorizedException(new Error("plain"))).toBe(false);
  });
});
