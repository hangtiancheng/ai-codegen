import { Edit, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/shared/lib";
import { formatCodegenType, type AppVo } from "@/shared/schemas";
import { Badge } from "./badge";
import { Button } from "./button";
import { ConfirmationDialog } from "./confirmation-dialog";
import { UserInfo } from "./user-info";

export type AppDetailModalProps = {
  readonly open: boolean;
  readonly app?: AppVo | undefined;
  readonly showActions?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
};

export function AppDetailModal({
  open,
  app,
  showActions = false,
  onOpenChange,
  onEdit,
  onDelete,
}: AppDetailModalProps): ReactNode {
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="bg-foreground/30 fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-detail-title"
        className="border-border bg-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="app-detail-title" className="text-xl font-semibold">
            App Details
          </h2>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
        <dl className="mt-5 grid gap-4 text-sm">
          <InfoRow label="Creator">
            <UserInfo user={app?.user} size="sm" />
          </InfoRow>
          <InfoRow label="Created">{formatDateTime(app?.createTime)}</InfoRow>
          <InfoRow label="Type">
            {app ? (
              <Badge variant="blue">{formatCodegenType(app.codegenType)}</Badge>
            ) : (
              "Unknown"
            )}
          </InfoRow>
        </dl>
        {showActions ? (
          <div className="border-border mt-6 flex gap-3 border-t pt-4">
            <Button onClick={onEdit}>
              <Edit className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        ) : null}
      </section>
      <ConfirmationDialog
        open={confirmOpen}
        title="Delete app?"
        description="This action cannot be undone. The app will be permanently removed."
        confirmLabel="Delete"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete?.();
        }}
      />
    </div>,
    document.body,
  );
}

function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground min-w-0">{children}</dd>
    </div>
  );
}
