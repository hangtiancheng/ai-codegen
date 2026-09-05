import { type ReactNode } from "react";
import { type AppVo } from "@/shared/schemas";
import { AppCard, Badge, EmptyState, LoadingState } from "@/shared/ui";

export type AppSectionProps = {
  readonly title: string;
  readonly description: string;
  readonly apps: ReadonlyArray<AppVo>;
  readonly loading: boolean;
  readonly featured?: boolean;
  readonly onViewDetails: (app: AppVo) => void;
  readonly onViewChat: (app: AppVo) => void;
};

export function AppSection({
  title,
  description,
  apps,
  loading,
  featured = false,
  onViewDetails,
  onViewChat,
}: AppSectionProps): ReactNode {
  return (
    <section className="grid gap-6">
      <header className="border-border flex items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        {!loading && apps.length > 0 ? (
          <Badge variant="secondary" className="shrink-0">
            {apps.length} {apps.length === 1 ? "app" : "apps"}
          </Badge>
        ) : null}
      </header>
      {loading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}`} />
      ) : null}
      {!loading && apps.length === 0 ? (
        <EmptyState
          title="No apps found"
          description="New generated apps will appear here once available."
        />
      ) : null}
      {!loading && apps.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              featured={featured}
              onViewDetails={onViewDetails}
              onViewChat={onViewChat}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
