import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test";
import { ChatComposer } from "./chat-composer";

describe("ChatComposer", () => {
  it("disables prompt input and send for read-only viewers", async () => {
    const onSend = vi.fn();
    const { user } = renderWithProviders(
      <ChatComposer
        value="Improve header"
        generating={false}
        canManage={false}
        hasSelectedElement={false}
        onChange={() => undefined}
        onSend={onSend}
      />,
    );

    const input = screen.getByLabelText("Chat message");
    const send = screen.getByRole("button", { name: "Send" });
    expect(input).toBeDisabled();
    expect(send).toBeDisabled();

    await user.click(send);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables prompt input while generation is running", async () => {
    const onSend = vi.fn();
    const { user } = renderWithProviders(
      <ChatComposer
        value="Improve header"
        generating
        canManage
        hasSelectedElement={false}
        onChange={() => undefined}
        onSend={onSend}
      />,
    );

    const input = screen.getByLabelText("Chat message");
    const send = screen.getByRole("button", { name: "Send" });
    expect(input).toBeDisabled();
    expect(send).toBeDisabled();

    await user.type(input, "{enter}");

    expect(onSend).not.toHaveBeenCalled();
  });
});
