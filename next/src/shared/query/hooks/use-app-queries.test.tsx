import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { envelope, requestedUrlContains } from "@/test/http-test-helpers";
import { useAdminAppPage, useAppById } from "./use-app-queries";

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
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

describe("app query hooks", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("does not fetch app details without an app id", () => {
    const { result } = renderHook(() => useAppById(undefined), {
      wrapper: createWrapper(createClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches admin app pages with the provided query params", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: appPage() }));

    const { result } = renderHook(() => useAdminAppPage({ pageNum: 2, pageSize: 10 }), {
      wrapper: createWrapper(createClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pageNumber).toBe(2);
    expect(requestedUrlContains(fetchSpy.mock.calls, "app/admin/list/page/vo")).toBe(true);
  });
});

function appPage(): unknown {
  return {
    records: [
      {
        id: appIdSchema.parse(10),
        appName: "Admin App",
        initPrompt: "Build an admin app",
        codegenType: "VANILLA_HTML",
        userId: 2,
      },
    ],
    pageNumber: 2,
    pageSize: 10,
    totalPage: 2,
    totalRow: 11,
  };
}
