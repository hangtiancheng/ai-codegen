import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "./button";

export type DeploySuccessModalProps = {
  readonly open: boolean;
  readonly deployUrl: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenSite?: () => void;
};

export function DeploySuccessModal({
  open,
  deployUrl,
  onOpenChange,
  onOpenSite,
}: DeploySuccessModalProps): ReactNode {
  if (!open) {
    return null;
  }

  const handleCopy = (): void => {
    void navigator.clipboard
      .writeText(deployUrl)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  };

  return createPortal(
    <div className="bg-foreground/30 fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-success-title"
        className="border-border bg-card max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-6 text-center shadow-xl"
      >
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 id="deploy-success-title" className="mt-4 text-xl font-semibold">
          Deploy Successful
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Your website is live. Share or open the deployment link below.
        </p>
        <div className="border-input bg-background mt-5 flex rounded-lg border p-1">
          <input
            value={deployUrl}
            readOnly
            aria-label="Deployment URL"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          />
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="size-4" aria-hidden="true" />
            Copy
          </Button>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onOpenSite}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Visit Website
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
