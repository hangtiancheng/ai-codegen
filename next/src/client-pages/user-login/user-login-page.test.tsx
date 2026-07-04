import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { renderWithProviders } from "@/test";
import { UserLoginPage } from "./user-login-page";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("UserLoginPage", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
    useUserStore.setState({ status: "anonymous", user: null });
  });

  afterEach(() => {
    fetchSpy.mockReset();
    useUserStore.setState({ status: "anonymous", user: null });
  });

  it("renders accessible fields and submits valid credentials", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({
        code: 0,
        data: {
          id: "1",
          userAccount: "demo-user",
          username: "Demo User",
          userRole: "USER",
        },
      }),
    );

    const { user } = renderWithProviders(<UserLoginPage />);
    await user.type(screen.getByLabelText("Account"), "demo-user");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(useUserStore.getState().user?.userAccount).toBe("demo-user");
    });
    expect(useUserStore.getState().user?.userRole).toBe("user");
  });

  it("shows validation feedback for invalid credentials", async () => {
    const { user } = renderWithProviders(<UserLoginPage />);
    const account = screen.getByLabelText("Account");
    const password = screen.getByLabelText("Password");

    await user.type(account, "abc");
    await user.tab();
    await user.type(password, "short");
    await user.tab();

    expect(await screen.findByText(/4/)).toBeInTheDocument();
    expect(await screen.findByText(/8/)).toBeInTheDocument();
  });
});
