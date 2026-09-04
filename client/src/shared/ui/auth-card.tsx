import { type ReactNode } from "react";
import { cn } from "cn";

export type AuthCardProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
};

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: AuthCardProps): ReactNode {
  return (
    <section
      className={cn(
        "border-border bg-card w-full max-w-md rounded-xl border p-6 shadow-sm",
        "animate__animated animate__fadeIn animate__faster",
        className,
      )}
    >
      <header className="mb-5 flex flex-col gap-1">
        <h1 className="text-foreground text-xl font-semibold">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </header>
      {children}
      {footer ? (
        <footer className="text-muted-foreground mt-5 text-sm">{footer}</footer>
      ) : null}
    </section>
  );
}
