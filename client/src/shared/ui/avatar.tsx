import { type ReactNode } from "react";
import { cn } from "@/shared/lib";

type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  readonly src?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly size?: AvatarSize;
  readonly className?: string;
};

const sizeClass: Record<AvatarSize, string> = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
};

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: AvatarProps): ReactNode {
  const fallback = name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <span
      className={cn(
        "border-primary/10 bg-primary/10 text-primary inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold",
        sizeClass[size],
        className,
      )}
      aria-label={name ?? "Unknown user"}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        fallback
      )}
    </span>
  );
}
