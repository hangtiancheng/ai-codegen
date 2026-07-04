import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test";
import { ChatActions } from "./chat-actions";

describe("ChatActions", () => {
  it("guards deploy and download actions for viewers", async () => {
    const onDeploy = vi.fn();
    const onDownload = vi.fn();
    const { user } = renderWithProviders(
      <ChatActions
        canManage={false}
        deploying={false}
        downloading={false}
        onDeploy={onDeploy}
        onDownload={onDownload}
      />,
    );

    const deploy = screen.getByRole("button", { name: "Deploy" });
    const download = screen.getByRole("button", { name: "Download Code" });
    expect(deploy).toBeDisabled();
    expect(download).toBeDisabled();

    await user.click(deploy);
    await user.click(download);

    expect(onDeploy).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
  });
});
