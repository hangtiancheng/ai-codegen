import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AdminChatManagePage } from "./admin-chat-manage-page";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminChatManagePage", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
    useUserStore.setState({
      status: "authenticated",
      user: loginUserVoSchema.parse({
        id: 1,
        userAccount: "admin@example.com",
        userRole: "admin",
      }),
    });
  });

  it("filters chat messages and opens read-only message details", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: chatPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: chatPage() }));

    const { user } = renderWithProviders(<AdminChatManagePage />);

    const messageElements = await screen.findAllByText("Generate dashboard");
    expect(messageElements.length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Message"), "dashboard");
    await user.selectOptions(screen.getByLabelText("Message type"), "user");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(hasRequestBody(fetchSpy.mock.calls, "dashboard")).toBe(true);
      expect(hasRequestBody(fetchSpy.mock.calls, '"messageType":"user"')).toBe(true);
    });

    const summary = messageElements.at(0);
    expect(summary).toBeDefined();
    if (summary) {
      await user.click(summary);
    }
    expect(screen.getAllByText("Generate dashboard").length).toBeGreaterThan(0);
  });

  it("routes from a message to the app chat workspace", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: chatPage() }));

    const { user } = renderWithProviders(
      <Routes>
        <Route path="/" element={<AdminChatManagePage />} />
        <Route path="/app/chat/:id" element={<div>Chat Route</div>} />
      </Routes>,
    );

    expect(await screen.findAllByText("Generate dashboard")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "View chat" }));

    expect(screen.getByText("Chat Route")).toBeInTheDocument();
  });
});

function hasRequestBody(calls: ReadonlyArray<ReadonlyArray<unknown>>, expected: string): boolean {
  return calls.some((call) => {
    const init = call[1];
    if (!isRequestInit(init) || typeof init.body !== "string") {
      return false;
    }
    return init.body.includes(expected);
  });
}

function isRequestInit(value: unknown): value is RequestInit {
  return typeof value === "object" && value !== null && "body" in value;
}

function chatPage(): unknown {
  return {
    records: [
      {
        id: 20,
        message: "Generate dashboard",
        messageType: "user",
        appId: 10,
        userId: 2,
        createTime: "2026-05-18T10:00:00Z",
      },
    ],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}
