import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/shared/lib";

export type ErrorStateProps = {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function ErrorState({
  title = "Unable to load content",
  description,
  action,
  className,
}: ErrorStateProps): ReactNode {
  return (
    <section
      role="alert"
      className={cn(
        "border-destructive/25 bg-destructive/5 flex flex-col items-center justify-center rounded-xl border px-6 py-10 text-center",
        className,
      )}
    >
      <div className="border-destructive/15 bg-background text-destructive mb-4 rounded-full border p-3 shadow-sm">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
