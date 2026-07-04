import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AdminAppManagePage } from "./admin-app-manage-page";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminAppManagePage", () => {
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

  it("filters apps and toggles featured priority", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: appPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: true }))
      .mockResolvedValueOnce(envelope({ code: 0, data: appPage() }));

    const { user } = renderWithProviders(<AdminAppManagePage />);

    expect(await screen.findByText("Admin App")).toBeInTheDocument();
    expect(screen.getByAltText("Admin App")).toBeInTheDocument();
    expect(screen.getAllByText(/2026/)).toHaveLength(2);
    await user.type(screen.getByLabelText("App name"), "Admin");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(hasRequestBody(fetchSpy.mock.calls, "Admin")).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "Feature" }));
    await waitFor(() => {
      expect(hasRequestBody(fetchSpy.mock.calls, '"priority":99')).toBe(true);
    });
  });

  it("opens the admin edit route from app actions", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: appPage() }));

    const { user } = renderWithProviders(
      <Routes>
        <Route path="/" element={<AdminAppManagePage />} />
        <Route path="/app/edit/:id" element={<div>Edit Route</div>} />
      </Routes>,
    );

    expect(await screen.findByText("Admin App")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit Route")).toBeInTheDocument();
  });
});

function hasRequestBody(
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  expected: string,
): boolean {
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

function appPage(): unknown {
  return {
    records: [
      {
        id: 10,
        appName: "Admin App",
        appCover: "https://example.com/admin-app.png",
        initPrompt: "Build an admin app",
        codegenType: "VANILLA_HTML",
        userId: 2,
        priority: 0,
        deployTime: "2026-05-17T10:00:00Z",
        createTime: "2026-05-18T10:00:00Z",
      },
    ],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}
