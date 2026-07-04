import { Download, ExternalLink, Rocket } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui";

export type AppEditToolbarProps = {
  readonly deploying: boolean;
  readonly downloading: boolean;
  readonly canPreview: boolean;
  readonly onDeploy: () => void;
  readonly onPreview: () => void;
  readonly onDownload: () => void;
};

export function AppEditToolbar({
  deploying,
  downloading,
  canPreview,
  onDeploy,
  onPreview,
  onDownload,
}: AppEditToolbarProps): ReactNode {
  return (
    <section className="border-border bg-primary/5 flex flex-wrap gap-3 rounded-2xl border p-4">
      <Button onClick={onDeploy} isLoading={deploying}>
        <Rocket className="size-4" aria-hidden="true" />
        Deploy
      </Button>
      <Button variant="outline" onClick={onPreview} disabled={!canPreview}>
        <ExternalLink className="size-4" aria-hidden="true" />
        Preview
      </Button>
      <Button variant="secondary" onClick={onDownload} isLoading={downloading}>
        <Download className="size-4" aria-hidden="true" />
        Download Code
      </Button>
    </section>
  );
}
