import { screen } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runChatStream } from "@/shared/api";
import type { ChatHistory, VisualEditorElementInfo } from "@/shared/schemas";
import { renderWithProviders } from "@/test";
import { chatSessionApp, historyPage, selectedElementFixture } from "./chat-session-test-fixtures";
import { useChatSession } from "./use-chat-session";
import type { VisualEditorState } from "./use-visual-editor";

vi.mock("@/shared/api", () => ({
  runChatStream: vi.fn(),
}));
vi.mock("./chat-stream-url", () => ({
  buildChatStreamUrl: () => "http://localhost/stream",
}));

const streamMock = vi.mocked(runChatStream);
const noop = (): void => undefined;

type HarnessProps = {
  readonly historyRecords: ReadonlyArray<ChatHistory>;
  readonly canGenerate?: boolean;
  readonly autoSendInitialPrompt?: boolean;
  readonly selectedElement?: VisualEditorElementInfo;
  readonly onClear?: () => void;
  readonly onExit?: () => void;
};

function Harness({
  historyRecords,
  canGenerate = true,
  autoSendInitialPrompt = true,
  selectedElement,
  onClear = noop,
  onExit = noop,
}: HarnessProps): React.ReactNode {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const session = useChatSession(
    chatSessionApp,
    canGenerate,
    autoSendInitialPrompt,
    true,
    historyRecords,
    buildEditor(iframeRef, selectedElement, onClear, onExit),
    () => undefined,
  );

  return (
    <div>
      {session.messages.map((message) => (
        <p key={message.id}>{message.content || "Loading"}</p>
      ))}
      <button type="button" onClick={() => session.send("Improve header")}>
        Send
      </button>
    </div>
  );
}

describe("useChatSession", () => {
  beforeEach(() => {
    streamMock.mockReset();
    streamMock.mockResolvedValue(undefined);
  });

  it("keeps current generation messages when older history is appended", async () => {
    const { user, rerender } = renderWithProviders(<Harness historyRecords={historyPage(1)} />);

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Improve header")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();

    rerender(<Harness historyRecords={[...historyPage(1), ...historyPage(3)]} />);

    expect(screen.getByText("Older prompt")).toBeInTheDocument();
    expect(screen.getByText("Improve header")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("exits visual edit mode after sending selected element context", async () => {
    const onClear = vi.fn();
    const onExit = vi.fn();
    const { user } = renderWithProviders(
      <Harness
        historyRecords={[]}
        selectedElement={selectedElementFixture}
        onClear={onClear}
        onExit={onExit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onExit).toHaveBeenCalledOnce();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("blocks generation when the current user cannot manage the app", async () => {
    const { user } = renderWithProviders(<Harness historyRecords={[]} canGenerate={false} />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(streamMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Improve header")).not.toBeInTheDocument();
  });

  it("does not auto-send the initial prompt for admin viewers", () => {
    renderWithProviders(<Harness historyRecords={[]} autoSendInitialPrompt={false} />);

    expect(streamMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Build the app")).not.toBeInTheDocument();
  });
});

function buildEditor(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  selectedElement: VisualEditorElementInfo | undefined,
  onClear: () => void,
  onExit: () => void,
): VisualEditorState {
  return {
    iframeRef,
    editMode: selectedElement !== undefined,
    selectedElement,
    toggleEditMode: () => undefined,
    exitEditMode: onExit,
    clearSelection: onClear,
    handleIframeLoad: () => undefined,
  };
}
