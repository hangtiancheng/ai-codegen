import { MessageSquare } from "lucide-react";
import { type ReactNode } from "react";
import { type AppVo } from "@/shared/schemas";
import { Badge } from "./badge";
import { Button } from "./button";
import { UserInfo } from "./user-info";

export type AppCardProps = {
  readonly app: AppVo;
  readonly featured?: boolean;
  readonly onViewDetails?: (app: AppVo) => void;
  readonly onViewChat?: (app: AppVo) => void;
};

export function AppCard({
  app,
  featured = false,
  onViewDetails,
  onViewChat,
}: AppCardProps): ReactNode {
  return (
    <article className="group border-border bg-card overflow-hidden rounded-2xl border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="from-primary/10 via-background to-secondary relative flex h-44 items-center justify-center overflow-hidden bg-linear-to-br">
        {app.appCover ? (
          <img
            src={app.appCover}
            alt={app.appName}
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="border-primary/10 bg-background/80 text-primary rounded-2xl border px-5 py-3 text-sm font-semibold shadow-sm">
            App Preview
          </div>
        )}
        {featured ? (
          <Badge variant="blue" className="absolute top-3 left-3">
            Featured
          </Badge>
        ) : null}
        <div className="bg-foreground/45 absolute inset-0 flex items-center justify-center gap-3 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails?.(app)}
          >
            Details
          </Button>
          <Button size="sm" onClick={() => onViewChat?.(app)}>
            <MessageSquare className="size-4" aria-hidden="true" />
            View Chat
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 p-4">
        <UserInfo user={app.user} showName={false} />
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground truncate text-base font-semibold">
            {app.appName}
          </h3>
          <p className="text-muted-foreground truncate text-sm">
            {app.user?.userAccount ?? (featured ? "Official" : "Unknown User")}
          </p>
        </div>
      </div>
    </article>
  );
}
