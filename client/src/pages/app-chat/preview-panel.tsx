import { Edit3, Eye, Loader2, RefreshCw } from "lucide-react";
import { type RefObject, type ReactNode } from "react";
import { Button } from "@/shared/ui";

export type PreviewPanelProps = {
  readonly previewUrl: string | undefined;
  readonly editMode: boolean;
  readonly canEdit: boolean;
  readonly generating: boolean;
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly onIframeLoad: () => void;
  readonly onRefresh: () => void;
  readonly onToggleEditMode: () => void;
};

export function PreviewPanel({
  previewUrl,
  editMode,
  canEdit,
  generating,
  iframeRef,
  onIframeLoad,
  onRefresh,
  onToggleEditMode,
}: PreviewPanelProps): ReactNode {
  return (
    <section className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-2xl border shadow-sm">
      <header className="border-border flex items-center justify-between gap-3 border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">Preview</h2>
          <p className="text-muted-foreground text-xs">
            {previewUrl
              ? "Generated output is ready."
              : generating
                ? "Generation is in progress."
                : "Generate once to preview."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          {canEdit && previewUrl ? (
            <Button
              variant={editMode ? "primary" : "secondary"}
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
        {previewUrl ? (
          <iframe
            ref={iframeRef}
            title="Generated app preview"
            src={previewUrl}
            onLoad={onIframeLoad}
            className="h-full min-h-96 w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <PreviewPlaceholder generating={generating} />
        )}
      </div>
    </section>
  );
}

function PreviewPlaceholder({
  generating,
}: {
  readonly generating: boolean;
}): ReactNode {
  if (generating) {
    return (
      <div className="text-muted-foreground flex h-full min-h-96 flex-col items-center justify-center gap-3 text-sm">
        <Loader2 className="size-8 animate-spin" aria-hidden="true" />
        Generating website...
      </div>
    );
  }
  return (
    <div className="text-muted-foreground flex h-full min-h-96 items-center justify-center text-sm">
      No preview available yet.
    </div>
  );
}
