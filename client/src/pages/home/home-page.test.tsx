import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { HomePage } from "./home-page";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HomePage", () => {
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

  it("creates an app from the prompt composer", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: emptyPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: emptyPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: 12 }));

    const { user } = renderWithProviders(<HomePage />);
    await user.type(
      screen.getByLabelText("App description"),
      "Build a dashboard",
    );
    await user.click(screen.getByRole("button", { name: /create app/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("app/add"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("keeps the legacy app prompt length limit", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByLabelText("App description")).toHaveAttribute(
      "maxlength",
      "1000",
    );
  });
});

function emptyPage(): unknown {
  return {
    records: [],
    pageNumber: 1,
    pageSize: 6,
    totalPage: 0,
    totalRow: 0,
  };
}
