import type { ReactNode } from "react";
import { useAppById } from "@/shared/query";
import type { AppId } from "@/shared/schemas";
import { EmptyState, LoadingState } from "@/shared/ui";
import { AppChatWorkspace } from "./app-chat-workspace";

export function AppChatContent({ appId }: { readonly appId: AppId }): ReactNode {
  const appQuery = useAppById(appId);
  const app = appQuery.data;
  if (appQuery.isLoading) return <LoadingState label="Loading chat workspace" />;
  if (!app) return <EmptyState title="App not found" />;
  return <AppChatWorkspace key={app.id} app={app} />;
}
