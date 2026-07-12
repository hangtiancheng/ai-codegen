import { Download, ExternalLink } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/shared/ui";

export type AppEditToolbarProps = {
  readonly downloading: boolean;
  readonly onPreview: () => void;
  readonly onDownload: () => void;
};

export function AppEditToolbar({
  downloading,
  onPreview,
  onDownload,
}: AppEditToolbarProps): ReactNode {
  return (
    <section className="border-border bg-primary/5 flex flex-wrap gap-3 rounded-2xl border p-4">
      <Button variant="outline" onClick={onPreview}>
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
