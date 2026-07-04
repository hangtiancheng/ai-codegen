import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test";
import { UserRegisterPage } from "./user-register-page";

describe("UserRegisterPage", () => {
  it("renders accessible fields", () => {
    renderWithProviders(<UserRegisterPage />);

    expect(screen.getByLabelText("Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows validation feedback when passwords do not match", async () => {
    const { user } = renderWithProviders(<UserRegisterPage />);

    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password456");
    await user.tab();

    expect(await screen.findByText("passwords must match")).toBeInTheDocument();
  });
});
