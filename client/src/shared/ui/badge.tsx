import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/lib";

type BadgeVariant = "neutral" | "blue" | "success" | "warning";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  readonly variant?: BadgeVariant;
  readonly children: ReactNode;
};

const variantClass: Record<BadgeVariant, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  blue: "border-primary/20 bg-primary/10 text-primary",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
