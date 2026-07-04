import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { appVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppCard } from "./app-card";

const sampleApp = appVoSchema.parse({
  id: 1,
  appName: "Landing Page Builder",
  initPrompt: "Build a landing page",
  codegenType: "VANILLA_HTML",
  deployKey: "site-123",
  userId: 2,
  user: {
    id: 2,
    userAccount: "maker@example.com",
    username: "Maker",
    userRole: "user",
  },
});

describe("AppCard", () => {
  it("renders app metadata and featured state", () => {
    renderWithProviders(<AppCard app={sampleApp} featured />);

    expect(screen.getByText("Landing Page Builder")).toBeInTheDocument();
    expect(screen.getByText("maker@example.com")).toBeInTheDocument();
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("calls interaction callbacks with the selected app", async () => {
    const onViewChat = vi.fn();
    const onViewWork = vi.fn();
    const { user } = renderWithProviders(
      <AppCard
        app={sampleApp}
        onViewChat={onViewChat}
        onViewWork={onViewWork}
      />,
    );

    await user.click(screen.getByRole("button", { name: /view chat/i }));
    await user.click(screen.getByRole("button", { name: /view work/i }));

    expect(onViewChat).toHaveBeenCalledWith(sampleApp);
    expect(onViewWork).toHaveBeenCalledWith(sampleApp);
  });
});
