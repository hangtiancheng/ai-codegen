import { Download } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/shared/ui";

export type AppEditToolbarProps = {
  readonly downloading: boolean;
  readonly onDownload: () => void;
};

export function AppEditToolbar({
  downloading,
  onDownload,
}: AppEditToolbarProps): ReactNode {
  return (
    <section className="border-border bg-primary/5 flex flex-wrap gap-3 rounded-2xl border p-4">
      <Button variant="secondary" onClick={onDownload} isLoading={downloading}>
        <Download className="size-4" aria-hidden="true" />
        Download Code
      </Button>
    </section>
  );
}
