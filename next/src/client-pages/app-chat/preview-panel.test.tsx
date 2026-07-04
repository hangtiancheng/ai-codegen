import { screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test";
import { PreviewPanel } from "./preview-panel";

describe("PreviewPanel", () => {
  it("shows visual edit controls only when the owner can edit a ready preview", () => {
    renderPreview({ canEdit: true, previewUrl: "https://example.com/dist" });

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides visual edit controls for non-owner viewers", () => {
    renderPreview({ canEdit: false, previewUrl: "https://example.com/dist" });

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("hides visual edit controls before a preview is available", () => {
    renderPreview({ canEdit: true, previewUrl: undefined });

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("shows the generating state before a preview is ready", () => {
    renderWithProviders(
      <PreviewPanel
        previewUrl={undefined}
        editMode={false}
        canEdit
        generating
        iframeRef={createRef<HTMLIFrameElement>()}
        onIframeLoad={() => undefined}
        onRefresh={() => undefined}
        onToggleEditMode={vi.fn()}
      />,
    );

    expect(screen.getByText("Generating website...")).toBeInTheDocument();
    expect(screen.queryByTitle("Generated app preview")).not.toBeInTheDocument();
  });
});

function renderPreview({
  canEdit,
  previewUrl,
}: {
  readonly canEdit: boolean;
  readonly previewUrl: string | undefined;
}): void {
  renderWithProviders(
    <PreviewPanel
      previewUrl={previewUrl}
      editMode={false}
      canEdit={canEdit}
      generating={false}
      iframeRef={createRef<HTMLIFrameElement>()}
      onIframeLoad={() => undefined}
      onRefresh={() => undefined}
      onToggleEditMode={vi.fn()}
    />,
  );
}
