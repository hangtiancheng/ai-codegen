import {
  appVoSchema,
  chatHistorySchema,
  type ChatHistory,
  type VisualEditorElementInfo,
} from "@/shared/schemas";

export const chatSessionApp = appVoSchema.parse({
  id: 1,
  appName: "Owner App",
  initPrompt: "Build the app",
  codegenType: "VANILLA_HTML",
  userId: 2,
});

export const selectedElementFixture: VisualEditorElementInfo = {
  tagName: "BUTTON",
  id: "",
  className: "primary",
  textContent: "Start",
  selector: "button.primary",
  pagePath: "/",
  rect: { top: 0, left: 0, width: 100, height: 40 },
};

export function historyPage(startId: number): ReadonlyArray<ChatHistory> {
  return [
    historyRecord(startId + 1, "Generated result", "ai"),
    historyRecord(
      startId,
      startId === 1 ? "Recent prompt" : "Older prompt",
      "user",
    ),
  ];
}

function historyRecord(
  id: number,
  message: string,
  messageType: "user" | "ai",
): ChatHistory {
  return chatHistorySchema.parse({
    id,
    message,
    messageType,
    appId: 1,
    userId: 2,
    createTime: `2025-01-01T00:00:0${id}.000Z`,
  });
}
