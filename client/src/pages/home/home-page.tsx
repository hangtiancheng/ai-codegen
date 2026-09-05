import { Sprout } from "lucide-react";
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
import { AppDetailModal } from "@/shared/ui";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <section className="fade-rise mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="border-primary/20 bg-primary/5 text-primary mb-6 inline-flex size-14 items-center justify-center rounded-full border shadow-sm">
          <Sprout className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-foreground flex flex-col items-center text-4xl font-semibold tracking-tight md:text-5xl">
          <span>Plant a prompt.</span>
          <span className="text-primary relative mt-1">
            Grow an app.
            <svg
              viewBox="0 0 320 14"
              fill="none"
              aria-hidden="true"
              className="text-primary/50 absolute -bottom-2 left-0 h-3 w-full"
            >
              <path
                d="M4 9C60 3 120 12 160 8s120-5 156-1"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="grow-line-path"
              />
            </svg>
          </span>
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-base">
          Describe the app you want and Swifty Codegen builds it — code, live
          preview, and all — ready to chat with, refine, and ship.
        </p>
      </section>
      <div className="mx-auto mt-10 max-w-2xl">
        <PromptComposer
          prompt={prompt}
          submitting={addAppMutation.isPending}
          onPromptChange={setPrompt}
          onSubmit={handleCreate}
        />
      </div>
      <div className="mt-16 flex flex-col gap-14">
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
      </div>
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
    </div>
  );
}
