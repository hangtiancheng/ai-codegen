import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test";
import { AppRoot } from "./app-root";

describe("AppRoot", () => {
  it("renders the routed application shell", async () => {
    renderWithProviders(<AppRoot />);
    expect(await screen.findByRole("heading", { name: /AI App Generator/i })).toBeInTheDocument();
  });
});
