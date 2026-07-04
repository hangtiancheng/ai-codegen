import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { RequireAdmin } from "./require-admin";
import { RequireAuth } from "./require-auth";
import { useUserStore } from "./user-store";

describe("route guards", () => {
  afterEach(() => {
    useUserStore.setState({ status: "anonymous", user: null });
  });

  it("redirects anonymous users to login with the current path", () => {
    useUserStore.setState({ status: "anonymous", user: null });

    renderWithProviders(
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
        <Route path="/user/login" element={<div>Login Page</div>} />
      </Routes>,
      { initialEntries: ["/protected"] },
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("blocks non-admin users from admin routes", () => {
    useUserStore.setState({
      status: "authenticated",
      user: loginUserVoSchema.parse({
        id: 1,
        userAccount: "demo-user",
        userRole: "user",
      }),
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div>Admin Content</div>
            </RequireAdmin>
          }
        />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { initialEntries: ["/admin"] },
    );

    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });
});
