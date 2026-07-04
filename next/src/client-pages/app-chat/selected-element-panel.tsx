import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { VisualEditorElementInfo } from "@/shared/schemas";
import { Button } from "@/shared/ui";

export type SelectedElementPanelProps = {
  readonly element: VisualEditorElementInfo | undefined;
  readonly onClear: () => void;
};

export function SelectedElementPanel({ element, onClear }: SelectedElementPanelProps): ReactNode {
  if (element === undefined) {
    return null;
  }
  return (
    <aside className="animate__animated animate__fadeIn border-primary/20 bg-primary/5 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-primary text-sm font-semibold">Selected Element</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {element.tagName.toLowerCase()} · {element.selector}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>
      </div>
      {element.textContent ? (
        <p className="text-foreground mt-3 line-clamp-3 text-sm">{element.textContent}</p>
      ) : null}
    </aside>
  );
}
