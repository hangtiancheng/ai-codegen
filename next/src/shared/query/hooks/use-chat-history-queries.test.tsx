import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { envelope, requestedUrlContains } from "@/test/http-test-helpers";
import { useAdminChatHistoryPage, useAppChatHistoryPage } from "./use-chat-history-queries";

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

describe("chat history query hooks", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("does not fetch app history without an app id", () => {
    const { result } = renderHook(() => useAppChatHistoryPage(undefined, { pageSize: 10 }), {
      wrapper: createWrapper(createClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches admin chat history pages", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: chatPage() }));

    const { result } = renderHook(() => useAdminChatHistoryPage({ pageNum: 1, pageSize: 10 }), {
      wrapper: createWrapper(createClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.records[0].messageType).toBe("user");
    expect(requestedUrlContains(fetchSpy.mock.calls, "admin/list/page/vo")).toBe(true);
  });
});

function chatPage(): unknown {
  return {
    records: [
      {
        id: 20,
        appId: appIdSchema.parse(10),
        userId: 2,
        message: "Generate dashboard",
        messageType: "user",
        createTime: "2026-05-18T10:00:00Z",
      },
    ],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}
