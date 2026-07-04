import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiException } from "./api-error";
import { createHttpClient } from "./http-client";
import {
  clearUnauthorizedRedirectHandler,
  setUnauthorizedRedirectHandler,
} from "./unauthorized-handler";

const baseUrl = "https://api.test.local/api/";
const dataSchema = z.object({ id: z.number() });

function envelope(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createHttpClient", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
    clearUnauthorizedRedirectHandler();
  });
  afterEach(() => {
    clearUnauthorizedRedirectHandler();
  });

  it("parses successful envelope through schema", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: { id: 7 } }));
    const client = createHttpClient(() => baseUrl);
    const result = await client.request({ method: "GET", url: "thing" }, dataSchema);
    expect(result).toEqual({ id: 7 });
  });

  it("builds URL with query params", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: { id: 1 } }));
    const client = createHttpClient(() => baseUrl);
    await client.request({ method: "GET", url: "thing", query: { id: 1 } }, dataSchema);
    const [url] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`${baseUrl}thing?id=1`);
  });

  it("throws business error on non-zero code", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 40000, message: "bad request" }));
    const client = createHttpClient(() => baseUrl);
    await expect(client.request({ method: "GET", url: "thing" }, dataSchema)).rejects.toMatchObject(
      {
        error: { kind: "business", code: 40000, message: "bad request" },
      },
    );
  });

  it("invokes redirect handler and throws unauthorized on 40100", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 40100, message: "Please login" }));
    const handler = vi.fn();
    setUnauthorizedRedirectHandler(handler);
    const client = createHttpClient(() => baseUrl);
    await expect(
      client.request({ method: "GET", url: "thing" }, dataSchema),
    ).rejects.toBeInstanceOf(ApiException);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("suppresses redirect handler when requested", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 40100, message: "Please login" }));
    const handler = vi.fn();
    setUnauthorizedRedirectHandler(handler);
    const client = createHttpClient(() => baseUrl);

    await expect(
      client.request(
        {
          method: "GET",
          url: "thing",
          suppressUnauthorizedRedirect: true,
        },
        dataSchema,
      ),
    ).rejects.toBeInstanceOf(ApiException);
    expect(handler).not.toHaveBeenCalled();
  });

  it("classifies 5xx as http error", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const client = createHttpClient(() => baseUrl);
    await expect(client.request({ method: "GET", url: "thing" }, dataSchema)).rejects.toMatchObject(
      { error: { kind: "http", status: 500 } },
    );
  });

  it("classifies invalid JSON as parse error", async () => {
    const consoleErrorSpy = vi
      .spyOn(globalThis.console, "error")
      .mockImplementationOnce(() => undefined);
    fetchSpy.mockResolvedValueOnce(
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createHttpClient(() => baseUrl);
    await expect(client.request({ method: "GET", url: "thing" }, dataSchema)).rejects.toMatchObject(
      { error: { kind: "parse" } },
    );
    consoleErrorSpy.mockRestore();
  });

  it("classifies fetch failures as network error", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("offline"));
    const client = createHttpClient(() => baseUrl);
    await expect(client.request({ method: "GET", url: "thing" }, dataSchema)).rejects.toMatchObject(
      {
        error: { kind: "network", message: "offline" },
      },
    );
  });

  it("classifies AbortError as aborted", async () => {
    const controller = new AbortController();
    fetchSpy.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    const client = createHttpClient(() => baseUrl);
    await expect(
      client.request({ method: "GET", url: "thing", signal: controller.signal }, dataSchema),
    ).rejects.toMatchObject({ error: { kind: "aborted" } });
  });
});
