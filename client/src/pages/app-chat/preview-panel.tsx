import { Edit3, Eye, Loader2, RefreshCw } from "lucide-react";
import { useMemo, type RefObject, type ReactNode } from "react";
import { Button } from "@/shared/ui";
import { parseAnsiLines } from "./ansi-log";
import { getPreviewStatusMessage, type PreviewStatus } from "./preview-status";

export type PreviewPanelProps = {
  readonly canEdit: boolean;
  readonly editMode: boolean;
  readonly error: string | undefined;
  readonly generating: boolean;
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly logs: string;
  readonly onIframeLoad: () => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onToggleEditMode: () => void;
  readonly previewUrl: string | undefined;
  readonly status: PreviewStatus;
};

export function PreviewPanel({
  canEdit,
  editMode,
  error,
  generating,
  iframeRef,
  logs,
  onIframeLoad,
  onRefresh,
  onRetry,
  onToggleEditMode,
  previewUrl,
  status,
}: PreviewPanelProps): ReactNode {
  return (
    <section className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-2xl border shadow-sm">
      <header className="border-border flex items-center justify-between gap-3 border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">Preview</h2>
          <p className="text-muted-foreground text-xs">
            {generating && status === "idle"
              ? "Generation is in progress."
              : getPreviewStatusMessage(status)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={previewUrl === undefined}
            onClick={onRefresh}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          {canEdit && previewUrl !== undefined ? (
            <Button
              variant={editMode ? "default" : "secondary"}
              size="sm"
              onClick={onToggleEditMode}
            >
              {editMode ? (
                <Eye className="size-4" aria-hidden="true" />
              ) : (
                <Edit3 className="size-4" aria-hidden="true" />
              )}
              {editMode ? "View" : "Edit"}
            </Button>
          ) : null}
        </div>
      </header>
      <div className="bg-secondary/40 min-h-96 flex-1">
        {previewUrl !== undefined ? (
          <iframe
            ref={iframeRef}
            title="Generated app preview"
            src={previewUrl}
            onLoad={onIframeLoad}
            className="bg-card h-full min-h-96 w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <PreviewPlaceholder
            error={error}
            logs={logs}
            onRetry={onRetry}
            status={status}
          />
        )}
      </div>
    </section>
  );
}

function PreviewPlaceholder({
  error,
  logs,
  onRetry,
  status,
}: {
  readonly error: string | undefined;
  readonly logs: string;
  readonly onRetry: () => void;
  readonly status: PreviewStatus;
}): ReactNode {
  if (status === "failed") {
    return (
      <div className="flex h-full min-h-96 flex-col justify-center gap-3 p-6 text-sm">
        <p className="text-destructive font-medium">
          {error ?? "Preview failed to start."}
        </p>
        {logs.length > 0 ? <AnsiLogView logs={logs} /> : null}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onRetry}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }
  if (status !== "idle") {
    return (
      <div className="text-muted-foreground flex h-full min-h-96 flex-col items-center justify-center gap-3 text-sm">
        <Loader2 className="size-8 animate-spin" aria-hidden="true" />
        {getPreviewStatusMessage(status)}
      </div>
    );
  }
  return (
    <div className="text-muted-foreground flex h-full min-h-96 items-center justify-center text-sm">
      No preview available yet.
    </div>
  );
}

/** Render an install/dev-server log, translating ANSI colour codes to styles. */
function AnsiLogView({ logs }: { readonly logs: string }): ReactNode {
  const lines = useMemo(() => parseAnsiLines(logs), [logs]);
  return (
    <pre className="bg-background max-h-56 overflow-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap">
      {lines.map((spans, lineIndex) => (
        <div key={lineIndex}>
          {spans.length === 0
            ? "\u00a0"
            : spans.map((span, spanIndex) => (
                <span
                  key={spanIndex}
                  className={span.className === "" ? undefined : span.className}
                >
                  {span.text}
                </span>
              ))}
        </div>
      ))}
    </pre>
  );
}
