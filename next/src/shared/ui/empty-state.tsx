import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export type EmptyStateProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps): ReactNode {
  return (
    <section
      className={cn(
        "border-primary/25 bg-primary/5 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <div className="border-primary/15 bg-background text-primary mb-4 rounded-full border p-3 shadow-sm">
        <Sparkles className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
