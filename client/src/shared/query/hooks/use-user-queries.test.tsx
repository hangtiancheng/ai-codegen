import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { envelope } from "@/test/http-test-helpers";
import { useCurrentUser, useUserPage } from "./use-user-queries";

function createWrapper(client: QueryClient) {
  return function Wrapper({
    children,
  }: {
    readonly children: ReactNode;
  }): ReactNode {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe("user query hooks", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("returns null for unauthorized current-user envelopes", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({ code: 40100, message: "Please login" }),
    );
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(createClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("does not fetch disabled user pages", async () => {
    const { result } = renderHook(
      () => useUserPage({ pageNum: 1, pageSize: 10 }, false),
      { wrapper: createWrapper(createClient()) },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
