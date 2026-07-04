import { type ReactNode } from "react";
import { formatDateTime } from "@/shared/lib";
import { formatCodegenType, type AppVo } from "@/shared/schemas";
import { Badge, UserInfo } from "@/shared/ui";

export type AppEditInfoPanelProps = {
  readonly app: AppVo;
};

export function AppEditInfoPanel({ app }: AppEditInfoPanelProps): ReactNode {
  return (
    <section className="border-border bg-card grid gap-4 rounded-2xl border p-5 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold">App Info</h2>
        <p className="text-muted-foreground text-sm">
          Metadata is validated from the app detail API response.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoTile label="App ID" value={String(app.id)} />
        <InfoTile label="Creator">
          <UserInfo user={app.user} size="sm" />
        </InfoTile>
        <InfoTile label="Created" value={formatDateTime(app.createTime)} />
        <InfoTile label="Updated" value={formatDateTime(app.updateTime)} />
        <InfoTile
          label="Deployed"
          value={app.deployTime ? formatDateTime(app.deployTime) : "No"}
        />
        <InfoTile label="Generation Type">
          <Badge variant="blue">{formatCodegenType(app.codegenType)}</Badge>
        </InfoTile>
      </div>
    </section>
  );
}

function InfoTile({
  label,
  value,
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <div className="border-border bg-background rounded-xl border p-3">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="text-foreground mt-1 min-h-6 text-sm font-medium">
        {children ?? value}
      </div>
    </div>
  );
}
