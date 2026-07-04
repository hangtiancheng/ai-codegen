import type { ReactNode } from "react";
import { Button } from "@/shared/ui";

export type ChatActionsProps = {
  readonly canManage: boolean;
  readonly deploying: boolean;
  readonly downloading: boolean;
  readonly onDeploy: () => void;
  readonly onDownload: () => void;
};

export function ChatActions({
  canManage,
  deploying,
  downloading,
  onDeploy,
  onDownload,
}: ChatActionsProps): ReactNode {
  return (
    <section className="border-border bg-primary/5 flex flex-wrap gap-3 rounded-2xl border p-3">
      <Button disabled={!canManage} isLoading={deploying} onClick={onDeploy}>
        Deploy
      </Button>
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
