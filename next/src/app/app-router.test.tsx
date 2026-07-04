import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppRouter } from "./app-router";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppRouter", () => {
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

  it("redirects legacy admin route aliases to guarded kebab-case routes", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: userPage() }));

    renderWithProviders(<AppRouter />, {
      initialEntries: ["/admin/userManage"],
    });

    expect(await screen.findByText("User Management")).toBeInTheDocument();
    expect(await screen.findByText("member@example.com")).toBeInTheDocument();
  });

  it("redirects unknown routes to the homepage", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: emptyPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: emptyPage() }));

    renderWithProviders(<AppRouter />, { initialEntries: ["/missing"] });

    expect(await screen.findByText("AI App Generator")).toBeInTheDocument();
  });
});

function userPage(): unknown {
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
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}

function emptyPage(): unknown {
  return {
    records: [],
    pageNumber: 1,
    pageSize: 6,
    totalPage: 0,
    totalRow: 0,
  };
}
