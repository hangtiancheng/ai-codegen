import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { visualEditorElementInfoSchema } from "@/shared/schemas";
import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";
import { PreviewPanel } from "./preview-panel";
import { SelectedElementPanel } from "./selected-element-panel";

const selectedElement = visualEditorElementInfoSchema.parse({
  tagName: "BUTTON",
  id: "primary-cta",
  className: "primary-cta",
  selector: "button.primary-cta",
  textContent: "Start building",
  pagePath: "/",
  rect: { top: 128, left: 64, width: 180, height: 44 },
});

function ChatWorkspaceShowcase(): React.ReactNode {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="grid gap-4">
        <MessageList
          loadingHistory={false}
          hasMoreHistory
          onLoadMore={() => undefined}
          messages={[
            {
              id: "message-1",
              role: "user",
              content: "Create a landing page for a design tool.",
            },
            {
              id: "message-2",
              role: "ai",
              content: "Generated the first version with hero and pricing.",
            },
          ]}
        />
        <SelectedElementPanel
          element={selectedElement}
          onClear={() => undefined}
        />
        <ChatComposer
          value="Make the hero CTA more specific."
          generating={false}
          canManage
          hasSelectedElement
          onChange={() => undefined}
          onSend={() => undefined}
        />
      </div>
      <PreviewPanel
        previewUrl="https://example.com/preview"
        editMode
        canEdit
        generating={false}
        iframeRef={iframeRef}
        onIframeLoad={() => undefined}
        onRefresh={() => undefined}
        onToggleEditMode={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: "Features/App Chat",
  component: ChatWorkspaceShowcase,
} satisfies Meta<typeof ChatWorkspaceShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithPreviewAndSelection: Story = {};
