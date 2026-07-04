import type { ReactNode } from "react";
import { Button } from "./button";

export type ConfirmationDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps): ReactNode {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      className="bg-foreground/30 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
    >
      <section className="border-border bg-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <h2 id="confirmation-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
