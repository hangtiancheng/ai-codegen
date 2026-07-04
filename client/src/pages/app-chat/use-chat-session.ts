import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runChatStream } from "@/shared/api";
import { reportRuntimeIssue } from "@/shared/observability";
import { type AppVo, type ChatHistory } from "@/shared/schemas";
import {
  chatHistoryToMessages,
  createLoadingAiMessage,
  createUserMessage,
  type ChatMessage,
} from "./chat-message";
import { buildChatStreamUrl } from "./chat-stream-url";
import { appendSelectedElementContext } from "./selected-element-context";
import { type VisualEditorState } from "./use-visual-editor";

export type ChatSessionState = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly input: string;
  readonly generating: boolean;
  readonly setInput: (value: string) => void;
  readonly send: (message: string) => void;
};

export function useChatSession(
  app: AppVo | undefined,
  canGenerate: boolean,
  autoSendInitialPrompt: boolean,
  historyLoaded: boolean,
  historyRecords: ReadonlyArray<ChatHistory> | undefined,
  visualEditor: VisualEditorState,
  onPreviewReady: () => void,
): ChatSessionState {
  const [sessionMessages, setSessionMessages] = useState<
    ReadonlyArray<ChatMessage>
  >([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const autoSentRef = useRef(false);

  const runPrompt = useCallback(
    (message: string): void => {
      if (!app || !canGenerate || generating) return;
      const prompt = appendSelectedElementContext(
        message,
        visualEditor.selectedElement,
      );
      const userMessage = createUserMessage(prompt);
      const aiMessage = createLoadingAiMessage();
      setSessionMessages((current) => [...current, userMessage, aiMessage]);
      setGenerating(true);
      setInput("");
      cleanupVisualEditor(visualEditor);
      const controller = new AbortController();
      abortRef.current = controller;
      let content = "";
      void runChatStream(
        { url: buildChatStreamUrl(app.id, prompt), signal: controller.signal },
        {
          onChunk: (chunk) => {
            content += chunk;
            setSessionMessages((current) =>
              replaceMessage(current, aiMessage.id, content, false),
            );
          },
          onDone: () => {
            setGenerating(false);
            onPreviewReady();
          },
          onError: (error) => {
            setGenerating(false);
            if (error.error.kind !== "aborted") {
              reportRuntimeIssue({
                kind: "stream-failure",
                message: error.message,
                context: { appId: app.id },
                cause: error,
              });
              toast.error(error.message);
            }
            setSessionMessages((current) =>
              replaceMessage(current, aiMessage.id, error.message, false),
            );
          },
        },
      );
    },
    [app, canGenerate, generating, onPreviewReady, visualEditor],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const historyMessages = useMemo(
    () => chatHistoryToMessages(historyRecords ?? []),
    [historyRecords],
  );

  const messages = useMemo(
    () => [...historyMessages, ...sessionMessages],
    [historyMessages, sessionMessages],
  );

  useEffect(() => {
    if (!app || !autoSendInitialPrompt || !historyLoaded || autoSentRef.current)
      return;
    if (historyRecords !== undefined && historyRecords.length > 0) return;
    autoSentRef.current = true;
    runPrompt(app.initPrompt);
  }, [app, autoSendInitialPrompt, historyLoaded, historyRecords, runPrompt]);

  return {
    messages,
    input,
    generating,
    setInput,
    send: runPrompt,
  };
}

function cleanupVisualEditor(editor: VisualEditorState): void {
  if (editor.selectedElement === undefined) {
    editor.clearSelection();
    return;
  }
  editor.exitEditMode();
}

function replaceMessage(
  messages: ReadonlyArray<ChatMessage>,
  id: string,
  content: string,
  loading: boolean,
): ReadonlyArray<ChatMessage> {
  return messages.map((message) =>
    message.id === id ? { ...message, content, loading } : message,
  );
}
