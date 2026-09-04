import { type ReactNode } from "react";
import { cn } from "cn";

export type LoadingStateProps = {
  readonly label?: string;
  readonly className?: string;
};

export function LoadingState({
  label = "Loading content",
  className,
}: LoadingStateProps): ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-border bg-card text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border text-sm",
        className,
      )}
    >
      <span
        className="border-primary/20 border-t-primary size-6 animate-spin rounded-full border-2"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
