import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AdminUserManagePage } from "./admin-user-manage-page";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminUserManagePage", () => {
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

  it("submits filters and paginates user results", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: userPage(1) }))
      .mockResolvedValueOnce(envelope({ code: 0, data: userPage(1) }))
      .mockResolvedValueOnce(envelope({ code: 0, data: userPage(2) }));

    const { user } = renderWithProviders(<AdminUserManagePage />);

    expect(await screen.findByText("member@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Account"), "member");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(hasRequestBody(fetchSpy.mock.calls, "member")).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(hasRequestBody(fetchSpy.mock.calls, '"pageNum":2')).toBe(true);
    });
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

function userPage(pageNumber: number): unknown {
  return {
    records: [
      {
        id: 2,
        userAccount: "member@example.com",
        username: "Member",
        userRole: "user",
        createTime: "2026-05-18T10:00:00Z",
      },
    ],
    pageNumber,
    pageSize: 10,
    totalPage: 2,
    totalRow: 11,
  };
}
