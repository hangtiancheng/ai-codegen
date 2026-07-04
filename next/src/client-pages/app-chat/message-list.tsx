import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useState } from "react";
import type { ChatMessage } from "./chat-message";
import { MessageRow } from "./message-row";

export type MessageListProps = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly loadingHistory: boolean;
  readonly hasMoreHistory: boolean;
  readonly onLoadMore: () => void;
};

export function MessageList({
  messages,
  loadingHistory,
  hasMoreHistory,
  onLoadMore,
}: MessageListProps): ReactNode {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: messages.length,
    initialRect: { height: 384, width: 640 },
    overscan: 6,
    estimateSize: () => 112,
    getItemKey: (index) => messages[index]?.id ?? index,
    getScrollElement: () => scrollElement,
  });
  const virtualMessages = virtualizer.getVirtualItems();
  const renderedMessages: ReadonlyArray<VirtualMessageSnapshot> =
    virtualMessages.length > 0
      ? virtualMessages.map((message) => ({
          index: message.index,
          key: String(message.key),
          start: message.start,
        }))
      : messages.map((message, index) => ({
          index,
          key: message.id,
          start: index * 112,
        }));

  return (
    <section className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-2xl border shadow-sm">
      <div className="border-border border-b p-3">
        {hasMoreHistory || loadingHistory ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingHistory || !hasMoreHistory}
            className="text-primary text-sm font-medium disabled:opacity-60"
          >
            {loadingHistory ? "Loading history..." : "Load more history"}
          </button>
        ) : (
          <p className="text-muted-foreground text-sm">No more history.</p>
        )}
      </div>
      <div ref={setScrollElement} className="min-h-96 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Start chatting to generate the first version of this app.
          </p>
        ) : null}
        {messages.length > 0 ? (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {renderedMessages.map((virtualMessage) => {
              const message = messages[virtualMessage.index];
              if (message === undefined) return null;
              return (
                <MessageRow
                  key={virtualMessage.key}
                  message={message}
                  index={virtualMessage.index}
                  offset={virtualMessage.start}
                  measureElement={virtualizer.measureElement}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type VirtualMessageSnapshot = {
  readonly index: number;
  readonly key: string;
  readonly start: number;
};
