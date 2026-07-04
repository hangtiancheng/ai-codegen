import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { appIdSchema, loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppChatContent } from "./app-chat-content";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppChatContent", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
    useUserStore.setState({
      status: "authenticated",
      user: loginUserVoSchema.parse({
        id: 2,
        userAccount: "owner@example.com",
        userRole: "user",
      }),
    });
  });

  it("loads chat history and preview for an app", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appData() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: historyPage() }));

    renderWithProviders(<AppChatContent appId={appIdSchema.parse(1)} />);

    expect(await screen.findByText("Owner App")).toBeInTheDocument();
    expect(await screen.findByText("Please build it")).toBeInTheDocument();
    expect(await screen.findByText("Generated result")).toBeInTheDocument();
    expect(screen.getByText("No more history.")).toBeInTheDocument();
    expect(screen.getByTitle("Generated app preview")).toBeInTheDocument();
  });

  it("loads older history with the oldest loaded timestamp", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appData() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: fullHistoryPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: olderHistoryPage() }));

    const { user } = renderWithProviders(<AppChatContent appId={appIdSchema.parse(1)} />);

    await user.click(await screen.findByRole("button", { name: "Load more history" }));

    expect(await screen.findByText("Older prompt")).toBeInTheDocument();
    expect(screen.getByText("Recent prompt 1")).toBeInTheDocument();
    expect(screen.getByText("No more history.")).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    const historyUrls = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/chat-history/app/1"));
    const secondUrl = historyUrls.at(1);
    if (secondUrl === undefined) {
      throw new Error("Expected a second chat history request.");
    }
    expect(new URL(secondUrl).searchParams.get("cursor")).toBe("2025-01-01T00:00:01.000Z");
  });

  it("keeps preview empty before history or generation is ready", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appData(3) }))
      .mockResolvedValueOnce(envelope({ code: 0, data: emptyHistoryPage() }));

    renderWithProviders(<AppChatContent appId={appIdSchema.parse(1)} />);

    expect(await screen.findByText("Owner App")).toBeInTheDocument();
    expect(screen.getByText("No preview available yet.")).toBeInTheDocument();
    expect(screen.queryByTitle("Generated app preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});

function appData(userId = 2): unknown {
  return {
    id: 1,
    appName: "Owner App",
    initPrompt: "Please build it",
    codegenType: "VANILLA_HTML",
    userId,
  };
}

function historyPage(): unknown {
  return {
    records: [
      historyRecord(2, "Generated result", "ai", "2025-01-01T00:00:02.000Z"),
      historyRecord(1, "Please build it", "user", "2025-01-01T00:00:01.000Z"),
    ],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 2,
  };
}

function fullHistoryPage(): unknown {
  return {
    records: Array.from({ length: 10 }, (_, index) => {
      const id = 10 - index;
      return historyRecord(
        id,
        `Recent prompt ${id}`,
        id % 2 === 0 ? "ai" : "user",
        `2025-01-01T00:00:${String(id).padStart(2, "0")}.000Z`,
      );
    }),
    pageNumber: 1,
    pageSize: 10,
    totalPage: 2,
    totalRow: 12,
  };
}

function olderHistoryPage(): unknown {
  return {
    records: [
      historyRecord(11, "Older result", "ai", "2024-12-31T23:59:59.000Z"),
      historyRecord(12, "Older prompt", "user", "2024-12-31T23:59:58.000Z"),
    ],
    pageNumber: 2,
    pageSize: 10,
    totalPage: 2,
    totalRow: 12,
  };
}

function emptyHistoryPage(): unknown {
  return {
    records: [],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 0,
    totalRow: 0,
  };
}

function historyRecord(
  id: number,
  message: string,
  messageType: "user" | "ai",
  createTime: string,
): unknown {
  return {
    id,
    message,
    messageType,
    appId: 1,
    userId: 2,
    createTime,
  };
}
