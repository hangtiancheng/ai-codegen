import { toast } from "sonner";
import { downloadAppCode } from "@/shared/api";
import { reportRuntimeIssue } from "@/shared/observability";
import { type useDeployApp } from "@/shared/query";
import { type AppVo } from "@/shared/schemas";

export function handleChatDeploy(
  app: AppVo,
  mutate: ReturnType<typeof useDeployApp>["mutate"],
  setDeployUrl: (url: string) => void,
): void {
  mutate(
    { appId: app.id },
    {
      onSuccess: setDeployUrl,
      onError: (cause) => {
        reportRuntimeIssue({
          kind: "deploy-failure",
          message: "Deploy failed",
          context: { appId: app.id },
          cause,
        });
        toast.error("Deploy failed");
      },
    },
  );
}

export function handleChatDownload(
  app: AppVo,
  setDownloading: (value: boolean) => void,
): void {
  setDownloading(true);
  void downloadAppCode(app.id)
    .catch(() => toast.error("Download failed"))
    .finally(() => setDownloading(false));
}
