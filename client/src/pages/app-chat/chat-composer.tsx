import { Send } from "lucide-react";
import { type ReactNode } from "react";
import { Button, TextArea } from "@/shared/ui";

export type ChatComposerProps = {
  readonly value: string;
  readonly generating: boolean;
  readonly canManage: boolean;
  readonly hasSelectedElement: boolean;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
};

export function ChatComposer({
  value,
  generating,
  canManage,
  hasSelectedElement,
  onChange,
  onSend,
}: ChatComposerProps): ReactNode {
  return (
    <section className="border-border bg-card rounded-2xl border p-3 shadow-sm">
      {hasSelectedElement ? (
        <p className="text-primary mb-2 text-xs font-medium">
          Selected element context will be attached to the next prompt.
        </p>
      ) : null}
      <div className="flex gap-3">
        <TextArea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ask for a change, a new section, or a visual refinement..."
          aria-label="Chat message"
          disabled={!canManage || generating}
          rows={2}
          className="min-h-16 resize-none"
          onKeyDown={(event) => {
            if (
              canManage &&
              !generating &&
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          className="self-end"
          disabled={!canManage || generating || value.trim().length === 0}
          isLoading={generating}
          onClick={onSend}
        >
          <Send className="size-4" aria-hidden="true" />
          Send
        </Button>
      </div>
    </section>
  );
}
