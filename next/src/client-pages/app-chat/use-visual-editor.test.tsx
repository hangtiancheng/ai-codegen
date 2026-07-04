import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test";
import { useVisualEditor } from "./use-visual-editor";

function Harness(): React.ReactNode {
  const editor = useVisualEditor();
  return (
    <div>
      <button type="button" onClick={editor.toggleEditMode}>
        {editor.editMode ? "enabled" : "disabled"}
      </button>
      <button type="button" onClick={editor.clearSelection}>
        clear
      </button>
      <button type="button" onClick={editor.exitEditMode}>
        exit
      </button>
      <span>{editor.selectedElement?.selector ?? "none"}</span>
    </div>
  );
}

describe("useVisualEditor", () => {
  it("validates iframe messages before selecting elements", async () => {
    const { user } = renderWithProviders(<Harness />);

    window.dispatchEvent(new MessageEvent("message", { data: { type: "bad" } }));
    expect(screen.getByText("none")).toBeInTheDocument();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "ELEMENT_SELECTED",
          elementInfo: {
            tagName: "DIV",
            id: "",
            className: "card",
            textContent: "Hero",
            selector: ".card",
            pagePath: "",
            rect: { top: 0, left: 0, width: 100, height: 40 },
          },
        },
      }),
    );

    expect(await screen.findByText(".card")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("exits edit mode and clears selected elements", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole("button", { name: "disabled" }));
    expect(screen.getByRole("button", { name: "enabled" })).toBeInTheDocument();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "ELEMENT_SELECTED",
          elementInfo: {
            tagName: "DIV",
            id: "",
            className: "card",
            textContent: "Hero",
            selector: ".card",
            pagePath: "",
            rect: { top: 0, left: 0, width: 100, height: 40 },
          },
        },
      }),
    );

    expect(await screen.findByText(".card")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "exit" }));
    expect(screen.getByRole("button", { name: "disabled" })).toBeInTheDocument();
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
