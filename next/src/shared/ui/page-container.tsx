import type { ReactNode } from "react";

export type PageContainerProps = {
  readonly children: ReactNode;
  readonly title?: string;
  readonly description?: ReactNode;
};

export function PageContainer({ children, title, description }: PageContainerProps): ReactNode {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
      {title ? (
        <header className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </header>
      ) : null}
      <main className="flex w-full flex-col gap-4">{children}</main>
    </div>
  );
}
