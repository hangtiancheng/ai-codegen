import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { queryKeys } from "../query-keys";
import { useAddApp, useDeleteAppByAdmin, useUpdateAppByAdmin } from "./use-app-mutations";

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useAddApp", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });
  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("invalidates app queries after a successful add", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: 42 }));

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    client.setQueryData(queryKeys.app.all, "stale");
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useAddApp(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ initPrompt: "build me an app" });
    });

    await waitFor(() => {
      expect(result.current.data).toBe("42");
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.app.all,
    });
  });
});

describe("admin app mutations", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });
  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("invalidates app queries after an admin update", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: true }));
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const appId = appIdSchema.parse(10);

    const { result } = renderHook(() => useUpdateAppByAdmin(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: appId, priority: 99 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.app.byId(appId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.app.all,
    });
  });

  it("invalidates app queries after an admin delete", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: true }));
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteAppByAdmin(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: appIdSchema.parse(10) });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.app.all,
    });
  });
});

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}
