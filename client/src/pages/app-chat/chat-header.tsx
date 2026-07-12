import { Info, Pencil } from "lucide-react";
import { type ReactNode } from "react";
import { formatCodegenType, type AppVo } from "@/shared/schemas";
import { Badge, Button } from "@/shared/ui";

export type ChatHeaderProps = {
  readonly app: AppVo;
  readonly canManage: boolean;
  readonly onDetails: () => void;
  readonly onEdit: () => void;
};

export function ChatHeader({
  app,
  canManage,
  onDetails,
  onEdit,
}: ChatHeaderProps): ReactNode {
  return (
    <header className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-foreground truncate text-xl font-semibold">
          {app.appName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="blue">{formatCodegenType(app.codegenType)}</Badge>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onDetails}>
          <Info className="size-4" aria-hidden="true" />
          Details
        </Button>
        {canManage ? (
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
        ) : null}
      </div>
    </header>
  );
}
