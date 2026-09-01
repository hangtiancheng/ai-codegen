import { AlertTriangle, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import type { AppId, VisualEditorElementInfo } from "@/shared/schemas";
import { useWorkspace } from "./workspace";
import { AgentComposer } from "./chat/agent-composer";
import { AgentStatusBar } from "./chat/agent-status-bar";
import { AgentTranscriptView } from "./chat/agent-transcript-view";
import { CapabilityDrawer } from "./chat/capability-drawer";
import {
  AgentQuestionDialog,
  PermissionDialog,
} from "./chat/permission-dialog";
import type {
  AgentRunOptions,
  PermissionDecision,
  QuestionAnswers,
} from "./use-agent-socket";
import type {
  AgentTranscriptAction,
  AgentTranscriptState,
} from "./use-agent-transcript";
import { isAgentBusy } from "./use-agent-transcript";

export type ChatPaneProps = {
  readonly appId: AppId;
  readonly state: AgentTranscriptState;
  readonly canRun: boolean;
  readonly run: (input: string, options?: AgentRunOptions) => boolean;
  readonly abort: () => boolean;
  readonly respondPermission: (
    interactionId: string,
    decision: PermissionDecision,
  ) => boolean;
  readonly respondQuestion: (
    interactionId: string,
    answers: QuestionAnswers,
  ) => boolean;
  readonly dispatch: React.Dispatch<AgentTranscriptAction>;
  readonly className?: string;
};

function elementLabel(element: VisualEditorElementInfo): string {
  const id = element.id.length > 0 ? `#${element.id}` : "";
  return `${element.tagName.toLowerCase()}${id} · ${element.selector}`;
}

export function ChatPane({
  appId,
  state,
  canRun,
  run,
  abort,
  respondPermission,
  respondQuestion,
  dispatch,
  className,
}: ChatPaneProps): ReactNode {
  const workspace = useWorkspace();
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const busy = isAgentBusy(state.runtimeStatus);
  const connected = state.connectionState === "connected";
  const lastCommand = state.commandResults.at(-1);

  const handleSend = (): void => {
    const text = input.trim();
    if (text.length === 0 || !canRun || busy || !connected) return;
    const selected = workspace.selectedElement;
    workspace.saveAll();
    void workspace.flushTerminalSync().finally(() => {
      const ok = run(
        text,
        selected === undefined ? {} : { selectedElement: selected },
      );
      if (ok) {
        setInput("");
        workspace.clearSelection();
      }
    });
  };

  const handlePermission = (
    interactionId: string,
    decision: PermissionDecision,
  ): void => {
    respondPermission(interactionId, decision);
    dispatch({ type: "interaction_cleared", interactionId });
  };

  const handleQuestion = (
    interactionId: string,
    answers: QuestionAnswers,
  ): void => {
    respondQuestion(interactionId, answers);
    dispatch({ type: "interaction_cleared", interactionId });
  };

  return (
    <section
      className={cn(
        "border-border bg-card flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      <AgentStatusBar
        connectionState={state.connectionState}
        runtimeStatus={state.runtimeStatus}
        permissionMode={state.permissionMode}
        readOnly={state.readOnly || !canRun}
        onOpenCapabilities={() => setDrawerOpen(true)}
      />
      <AgentTranscriptView
        events={state.events}
        streamingText={state.streamingText}
        thinkingText={state.thinkingText}
        runtimeStatus={state.runtimeStatus}
        replaying={state.replaying}
      />
      {lastCommand !== undefined ? (
        <div className="border-border bg-muted/20 border-t px-4 py-2 text-xs">
          <span className="font-mono font-medium">/{lastCommand.command}</span>
          {lastCommand.error !== undefined ? (
            <span className="text-destructive ml-2">{lastCommand.error}</span>
          ) : lastCommand.result !== undefined ? (
            <pre className="text-muted-foreground mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(lastCommand.result, null, 2)}
            </pre>
          ) : (
            <span className="text-muted-foreground ml-2">ok</span>
          )}
        </div>
      ) : null}
      {state.errors.length > 0 ? (
        <div className="border-border space-y-1 border-t px-4 py-2">
          {state.errors.slice(-3).map((error) => (
            <div
              key={error.id}
              className="text-destructive flex items-center gap-2 text-xs"
            >
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{error.message}</span>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "dismiss_error", id: error.id })
                }
                aria-label="Dismiss error"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="border-border border-t p-3">
        <AgentComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onAbort={abort}
          candidates={state.candidates}
          running={busy}
          readOnly={!canRun || state.readOnly}
          connected={connected}
          selectedElementLabel={
            workspace.selectedElement === undefined
              ? undefined
              : elementLabel(workspace.selectedElement)
          }
          onClearSelectedElement={workspace.clearSelection}
        />
      </div>
      <PermissionDialog
        request={state.pendingPermission}
        onDecision={handlePermission}
      />
      <AgentQuestionDialog
        request={state.pendingQuestion}
        onSubmit={handleQuestion}
      />
      <CapabilityDrawer
        appId={appId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        canManage={canRun}
        onNewSession={() => {
          run("/clear");
          setDrawerOpen(false);
        }}
      />
    </section>
  );
}
