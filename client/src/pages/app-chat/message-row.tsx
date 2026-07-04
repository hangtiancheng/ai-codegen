import { Bot, User } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { MarkdownRenderer } from "@/shared/ui";
import { type ChatMessage } from "./chat-message";

export type MessageRowProps = {
  readonly index: number;
  readonly measureElement: (node: Element | null) => void;
  readonly message: ChatMessage;
  readonly offset: number;
};

export function MessageRow({
  index,
  measureElement,
  message,
  offset,
}: MessageRowProps): ReactNode {
  const isUser = message.role === "user";
  return (
    <article
      ref={measureElement}
      data-index={index}
      className="absolute top-0 left-0 w-full pb-4"
      style={{ transform: `translateY(${String(offset)}px)` }}
    >
      <div
        className={cn(
          "flex gap-3",
          isUser ? "flex-row-reverse justify-start" : "justify-start",
        )}
      >
        <div
          className={cn(
            "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          {isUser ? (
            <User className="size-4" aria-hidden="true" />
          ) : (
            <Bot className="size-4" aria-hidden="true" />
          )}
        </div>
        <div
          className={cn(
            "max-w-[min(42rem,calc(100%-3rem))] min-w-0 rounded-xl px-3",
            isUser
              ? "bg-primary/10 rounded-tr-sm"
              : "bg-background rounded-tl-sm",
          )}
        >
          {message.loading ? (
            <p className="text-muted-foreground text-sm">Generating...</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </article>
  );
}
