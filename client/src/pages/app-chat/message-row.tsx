import { Bot, Check, Loader2, User, X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { MarkdownRenderer } from "@/shared/ui";
import { type ChatMessage, type MessagePart } from "./chat-message";

export type MessageRowProps = {
  readonly index: number;
  readonly measureElement: (node: Element | null) => void;
  readonly message: ChatMessage;
  readonly offset: number;
};

function ToolPartRow({
  part,
}: {
  readonly part: Extract<MessagePart, { kind: "tool" }>;
}): ReactNode {
  const isError = part.status === "error";
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1 font-mono text-xs",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {part.status === "running" ? (
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
      ) : isError ? (
        <X className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="font-medium">{part.name}</span>
      {part.detail !== undefined && (
        <span className="truncate opacity-70">{part.detail}</span>
      )}
    </div>
  );
}

function MessageBody({
  message,
}: {
  readonly message: ChatMessage;
}): ReactNode {
  if (message.loading === true && message.parts === undefined) {
    return <p className="text-muted-foreground text-sm">Generating...</p>;
  }
  if (message.parts === undefined) {
    return <MarkdownRenderer content={message.content} />;
  }
  return (
    <>
      {message.parts.map((part, index) =>
        part.kind === "text" ? (
          <MarkdownRenderer key={index} content={part.text} />
        ) : (
          <ToolPartRow key={index} part={part} />
        ),
      )}
    </>
  );
}

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
          <MessageBody message={message} />
        </div>
      </div>
    </article>
  );
}
