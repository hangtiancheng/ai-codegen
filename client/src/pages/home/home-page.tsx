import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  selectIsAdmin,
  selectIsAuthenticated,
  useUserStore,
} from "@/shared/auth";
import {
  useAddApp,
  useAwesomeAppPage,
  useDeleteApp,
  useDeleteAppByAdmin,
  useMyAppPage,
} from "@/shared/query";
import { type AppVo } from "@/shared/schemas";
import { AppDetailModal, PageContainer } from "@/shared/ui";
import { AppSection } from "./app-section";
import { canManageApp } from "./home-actions";
import { homeAppListParams } from "./app-list-params";
import { PromptComposer } from "./prompt-composer";

export function HomePage(): ReactNode {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppVo | undefined>();
  const user = useUserStore((state) => state.user);
  const isAdmin = useUserStore(selectIsAdmin);
  const isAuthenticated = useUserStore(selectIsAuthenticated);
  const myAppsQuery = useMyAppPage(homeAppListParams, isAuthenticated);
  const awesomeAppsQuery = useAwesomeAppPage(homeAppListParams);
  const addAppMutation = useAddApp();
  const deleteAppMutation = useDeleteApp();
  const deleteAppByAdminMutation = useDeleteAppByAdmin();

  const handleCreate = (): void => {
    const initPrompt = prompt.trim();
    if (initPrompt.length === 0) {
      toast.warning("Please enter app description");
      return;
    }
    if (!isAuthenticated) {
      toast.warning("Please login first");
      navigate(`/user/login?redirect=${encodeURIComponent("/")}`);
      return;
    }
    addAppMutation.mutate(
      { initPrompt },
      {
        onSuccess: (appId) => {
          toast.success("App created successfully");
          navigate(`/app/chat/${appId}`);
        },
        onError: () => toast.error("Creation failed, please retry"),
      },
    );
  };

  const handleDelete = (): void => {
    if (selectedApp === undefined) {
      return;
    }
    const mutation = isAdmin ? deleteAppByAdminMutation : deleteAppMutation;
    mutation.mutate(
      { id: selectedApp.id },
      {
        onSuccess: () => {
          toast.success("App deleted");
          setSelectedApp(undefined);
        },
        onError: () => toast.error("Delete failed"),
      },
    );
  };

  const canManageSelected =
    selectedApp !== undefined &&
    (isAdmin || canManageApp(selectedApp, user?.id));

  return (
    <PageContainer title="Create apps with one prompt">
      <PromptComposer
        prompt={prompt}
        submitting={addAppMutation.isPending}
        onPromptChange={setPrompt}
        onSubmit={handleCreate}
      />
      {isAuthenticated ? (
        <AppSection
          title="My Apps"
          description="Continue editing, previewing, or chatting with your apps."
          apps={myAppsQuery.data?.records ?? []}
          loading={myAppsQuery.isLoading}
          onViewDetails={setSelectedApp}
          onViewChat={(app) => navigate(`/app/chat/${app.id}?view=1`)}
        />
      ) : null}
      <AppSection
        title="Awesome Cases"
        description="Featured generated apps from the community."
        apps={awesomeAppsQuery.data?.records ?? []}
        loading={awesomeAppsQuery.isLoading}
        featured
        onViewDetails={setSelectedApp}
        onViewChat={(app) => navigate(`/app/chat/${app.id}?view=1`)}
      />
      <AppDetailModal
        open={selectedApp !== undefined}
        app={selectedApp}
        showActions={canManageSelected}
        onOpenChange={(open) => {
          if (!open) setSelectedApp(undefined);
        }}
        onEdit={() => {
          if (selectedApp) navigate(`/app/edit/${selectedApp.id}`);
        }}
        onDelete={handleDelete}
      />
    </PageContainer>
  );
}
