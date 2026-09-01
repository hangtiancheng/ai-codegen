import { Download, Info, Pencil } from "lucide-react";
import { type ReactNode } from "react";
import { type AppVo } from "@/shared/schemas";
import { Button } from "@/shared/ui";

export type ChatHeaderProps = {
  readonly app: AppVo;
  readonly canManage: boolean;
  readonly downloading: boolean;
  readonly onDetails: () => void;
  readonly onEdit: () => void;
  readonly onDownload: () => void;
};

export function ChatHeader({
  app,
  canManage,
  downloading,
  onDetails,
  onEdit,
  onDownload,
}: ChatHeaderProps): ReactNode {
  return (
    <header className="border-border bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-2 shadow-sm">
      <h1 className="text-foreground min-w-0 truncate text-base font-semibold">
        {app.appName}
      </h1>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onDetails}>
          <Info className="size-4" aria-hidden="true" />
          Details
        </Button>
        {canManage ? (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          disabled={!canManage}
          isLoading={downloading}
          onClick={onDownload}
        >
          <Download className="size-4" aria-hidden="true" />
          Download Code
        </Button>
      </div>
    </header>
  );
}
