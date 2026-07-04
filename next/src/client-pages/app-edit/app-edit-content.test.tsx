import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/shared/auth";
import { appIdSchema, loginUserVoSchema } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppEditContent } from "./app-edit-content";

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppEditContent", () => {
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

  it("renders edit actions for the app owner", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({
        code: 0,
        data: {
          id: 1,
          appName: "Owner App",
          initPrompt: "Build an app",
          codegenType: "VANILLA_HTML",
          userId: 2,
        },
      }),
    );

    renderWithProviders(<AppEditContent appId={appIdSchema.parse(1)} />);

    expect(await screen.findByDisplayValue("Owner App")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deploy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download code/i })).toBeInTheDocument();
  });
});
