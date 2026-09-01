import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { selectIsAdmin, useUserStore } from "@/shared/auth";
import { useDeleteApp, useDeleteAppByAdmin } from "@/shared/query";
import { type AppVo } from "@/shared/schemas";
import { AppDetailModal, PageContainer } from "@/shared/ui";
import { handleChatDownload } from "./chat-action-handlers";
import { ChatActions } from "./chat-actions";
import { buildPreviewFixPrompt } from "./build-error-context";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { PreviewErrorPanel } from "./preview-error-panel";
import { PreviewPanel } from "./preview-panel";
import { SelectedElementPanel } from "./selected-element-panel";
import { useChatHistoryFeed } from "./use-chat-history-feed";
import { useChatSession } from "./use-chat-session";
import { usePreviewErrors } from "./use-preview-errors";
import { useVisualEditor } from "./use-visual-editor";
import { useWebContainerPreview } from "./use-webcontainer-preview";

export function AppChatWorkspace({ app }: { readonly app: AppVo }): ReactNode {
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const user = useUserStore((state) => state.user);
  const isAdmin = useUserStore(selectIsAdmin);
  const history = useChatHistoryFeed(app.id);
  const preview = useWebContainerPreview(
    app.id,
    history.loaded && history.records.length >= 2,
  );
  const deleteApp = useDeleteApp();
  const deleteAppByAdmin = useDeleteAppByAdmin();
  const visualEditor = useVisualEditor(preview.previewUrl);
  const previewErrors = usePreviewErrors();
  const isOwner = app.userId === user?.id;
  const canManage = isAdmin || isOwner;
  const shouldAutoSendInitialPrompt = isOwner;
  const session = useChatSession(
    app,
    canManage,
    shouldAutoSendInitialPrompt,
    history.loaded,
    history.records,
    visualEditor,
    () => {
      previewErrors.clear();
      preview.clearError();
      preview.resync();
    },
  );
  const fixablePreviewError =
    previewErrors.latest ??
    (preview.error === undefined
      ? undefined
      : {
          message: preview.error,
          ...(preview.logs.length > 0 && { stack: preview.logs }),
        });

  return (
    <PageContainer
      title="Chat Generation"
      description="Stream changes, preview output, and select visual elements safely."
    >
      <ChatHeader
        app={app}
        canManage={canManage}
        onDetails={() => setDetailsOpen(true)}
        onEdit={() => navigate(`/app/edit/${app.id}`)}
      />
      <ChatActions
        canManage={canManage}
        downloading={downloading}
        onDownload={() => handleChatDownload(app, setDownloading)}
      />
      <div className="grid min-h-180 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <MessageList
            messages={session.messages}
            loadingHistory={history.fetching}
            hasMoreHistory={history.hasMore}
            onLoadMore={history.loadMore}
          />
          <SelectedElementPanel
            element={visualEditor.selectedElement}
            onClear={visualEditor.clearSelection}
          />
          <PreviewErrorPanel
            error={fixablePreviewError}
            canFix={canManage}
            fixing={session.generating}
            onClear={() => {
              previewErrors.clear();
              preview.clearError();
            }}
            onFix={() => {
              if (fixablePreviewError === undefined) return;
              previewErrors.clear();
              preview.clearError();
              session.send(buildPreviewFixPrompt(fixablePreviewError));
            }}
          />
          <ChatComposer
            value={session.input}
            generating={session.generating}
            canManage={canManage}
            hasSelectedElement={visualEditor.selectedElement !== undefined}
            onChange={session.setInput}
            onSend={() => session.send(session.input)}
          />
        </div>
        <PreviewPanel
          previewUrl={preview.previewUrl}
          status={preview.status}
          error={preview.error}
          logs={preview.logs}
          editMode={visualEditor.editMode}
          canEdit={isOwner}
          generating={session.generating}
          iframeRef={visualEditor.iframeRef}
          onIframeLoad={visualEditor.handleIframeLoad}
          onRefresh={() => preview.reload(visualEditor.iframeRef.current)}
          onToggleEditMode={visualEditor.toggleEditMode}
        />
      </div>
      <AppDetailModal
        open={detailsOpen}
        app={app}
        showActions={canManage}
        onOpenChange={setDetailsOpen}
        onEdit={() => navigate(`/app/edit/${app.id}`)}
        onDelete={() => {
          const mutation = isAdmin ? deleteAppByAdmin : deleteApp;
          mutation.mutate(
            { id: app.id },
            {
              onSuccess: () => navigate("/", { replace: true }),
              onError: () => toast.error("Delete failed"),
            },
          );
        }}
      />
    </PageContainer>
  );
}
