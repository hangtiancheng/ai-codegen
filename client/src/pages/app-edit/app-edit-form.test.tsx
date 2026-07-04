import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { appVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppEditForm } from "./app-edit-form";

const sampleApp = appVoSchema.parse({
  id: 1,
  appName: "Original App",
  initPrompt: "Build a storefront",
  codegenType: "VANILLA_HTML",
  userId: 2,
});

describe("AppEditForm", () => {
  it("submits owner app name updates", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(
      <AppEditForm
        app={sampleApp}
        admin={false}
        submitting={false}
        onSubmit={onSubmit}
        onReset={() => undefined}
        onOpenChat={() => undefined}
      />,
    );

    const nameInput = screen.getByLabelText("App Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated App");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ appName: "Updated App" }),
      );
    });
  });

  it("shows admin-only fields for admins", () => {
    renderWithProviders(
      <AppEditForm
        app={sampleApp}
        admin
        submitting={false}
        onSubmit={() => undefined}
        onReset={() => undefined}
        onOpenChat={() => undefined}
      />,
    );

    expect(screen.getByLabelText("App Cover URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
  });
});
