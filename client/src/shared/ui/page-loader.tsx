import { type ReactNode } from "react";

export function PageLoader(): ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="text-muted-foreground flex min-h-[40vh] w-full items-center justify-center text-sm"
    >
      <span
        className="bg-muted-foreground/60 inline-block size-2 animate-pulse rounded-full"
        aria-hidden="true"
      />
      <span className="ml-2">Loading…</span>
    </div>
  );
}
