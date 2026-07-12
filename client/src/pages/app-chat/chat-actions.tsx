import { type ReactNode } from "react";
import { Button } from "@/shared/ui";

export type ChatActionsProps = {
  readonly canManage: boolean;
  readonly downloading: boolean;
  readonly onDownload: () => void;
};

export function ChatActions({
  canManage,
  downloading,
  onDownload,
}: ChatActionsProps): ReactNode {
  return (
    <section className="border-border bg-primary/5 flex flex-wrap gap-3 rounded-2xl border p-3">
      <Button
        variant="secondary"
        disabled={!canManage}
        isLoading={downloading}
        onClick={onDownload}
      >
        Download Code
      </Button>
    </section>
  );
}
