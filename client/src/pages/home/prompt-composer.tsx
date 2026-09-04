import { ArrowUp } from "lucide-react";
import { type ReactNode } from "react";
import { Button, TextArea } from "@/shared/ui";
import { quickPrompts } from "./quick-prompts";

export type PromptComposerProps = {
  readonly prompt: string;
  readonly submitting: boolean;
  readonly onPromptChange: (value: string) => void;
  readonly onSubmit: () => void;
};

export function PromptComposer({
  prompt,
  submitting,
  onPromptChange,
  onSubmit,
}: PromptComposerProps): ReactNode {
  return (
    <section className="mx-auto w-full">
      <div className="relative">
        <TextArea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe the app you want to generate..."
          rows={10}
          maxLength={3000}
          className="border-primary/15 bg-card resize-none rounded-2xl p-5 pr-16 text-base shadow-sm"
          aria-label="App description"
        />
        <Button
          className="absolute right-3 bottom-3 rounded-full"
          size="sm"
          disabled={submitting}
          isLoading={submitting}
          onClick={onSubmit}
        >
          <ArrowUp className="size-5" aria-hidden="true" />
          <span className="sr-only">Create app</span>
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {quickPrompts.map((item) => (
          <Button
            key={item.label}
            variant="outline"
            size="sm"
            onClick={() => onPromptChange(item.prompt)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
