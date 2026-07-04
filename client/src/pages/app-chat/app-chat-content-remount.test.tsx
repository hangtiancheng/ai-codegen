import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appIdSchema, type AppVo } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { AppChatContent } from "./app-chat-content";

vi.mock("./app-chat-workspace", async () => {
  const React = await import("react");
  return {
    AppChatWorkspace: ({ app }: { readonly app: AppVo }) => {
      const [initialId] = React.useState(app.id);
      return React.createElement(
        "p",
        {},
        `initial ${initialId} current ${app.id}`,
      );
    },
  };
});

function envelope(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppChatContent", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("remounts the chat workspace when the app id changes", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appData(1) }))
      .mockResolvedValueOnce(envelope({ code: 0, data: appData(2) }));

    const { rerender } = renderWithProviders(
      <AppChatContent appId={appIdSchema.parse(1)} />,
    );

    expect(await screen.findByText("initial 1 current 1")).toBeInTheDocument();

    rerender(<AppChatContent appId={appIdSchema.parse(2)} />);

    expect(await screen.findByText("initial 2 current 2")).toBeInTheDocument();
  });
});

function appData(id: number): unknown {
  return {
    id,
    appName: `App ${id}`,
    initPrompt: "Build the app",
    codegenType: "VANILLA_HTML",
    userId: 2,
  };
}
