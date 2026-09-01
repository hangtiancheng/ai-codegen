import { ShieldQuestion } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/shared/ui";
import type {
  AgentPermissionRequest,
  JsonValue,
} from "../use-agent-transcript";
import type { PermissionDecision } from "../use-agent-socket";

export type PermissionDialogProps = {
  readonly request: AgentPermissionRequest | undefined;
  readonly onDecision: (
    interactionId: string,
    decision: PermissionDecision,
  ) => void;
};

function formatArgs(args: JsonValue): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function PermissionDialog({
  request,
  onDecision,
}: PermissionDialogProps): ReactNode {
  if (request === undefined) return null;
  const args = formatArgs(request.args);
  return (
    <div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="border-border bg-card w-full max-w-lg rounded-2xl border p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="text-primary size-5" aria-hidden="true" />
          <h2 className="text-base font-semibold">Permission required</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          The agent wants to run{" "}
          <span className="text-foreground font-mono font-medium">
            {request.toolName}
          </span>
          {request.description !== undefined && request.description.length > 0
            ? `: ${request.description}`
            : "."}
        </p>
        {request.reason !== undefined && request.reason.length > 0 ? (
          <p className="text-muted-foreground mt-1 text-xs italic">
            {request.reason}
          </p>
        ) : null}
        {args !== "{}" && args.length > 0 ? (
          <pre className="border-border bg-muted/40 text-muted-foreground mt-3 max-h-52 overflow-auto rounded-lg border p-2.5 font-mono text-xs whitespace-pre-wrap">
            {args}
          </pre>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onDecision(request.interactionId, "deny")}
          >
            Deny
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDecision(request.interactionId, "allow")}
          >
            Allow once
          </Button>
          <Button
            onClick={() => onDecision(request.interactionId, "allowAlways")}
          >
            Always allow
          </Button>
        </div>
      </div>
    </div>
  );
}

export type QuestionDialogProps = {
  readonly request:
    import("../use-agent-transcript").AgentQuestionRequest | undefined;
  readonly onSubmit: (
    interactionId: string,
    answers: Record<string, string | string[]>,
  ) => void;
};

export function AgentQuestionDialog({
  request,
  onSubmit,
}: QuestionDialogProps): ReactNode {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  if (request === undefined) return null;

  const toggle = (question: string, label: string, multi: boolean): void => {
    setAnswers((current) => {
      const existing = current[question] ?? [];
      if (multi) {
        const next = existing.includes(label)
          ? existing.filter((item) => item !== label)
          : [...existing, label];
        return { ...current, [question]: next };
      }
      return { ...current, [question]: [label] };
    });
  };

  const allAnswered = request.questions.every(
    (question) => (answers[question.question] ?? []).length > 0,
  );

  const submit = (): void => {
    const payload: Record<string, string | string[]> = {};
    for (const question of request.questions) {
      const selected = answers[question.question] ?? [];
      payload[question.question] = question.multiSelect
        ? selected
        : (selected[0] ?? "");
    }
    onSubmit(request.interactionId, payload);
    setAnswers({});
  };

  return (
    <div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="border-border bg-card max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border p-5 shadow-xl">
        <h2 className="text-base font-semibold">The agent has a question</h2>
        <div className="mt-4 space-y-5">
          {request.questions.map((question, questionIndex) => {
            const selected = answers[question.question] ?? [];
            return (
              <fieldset key={questionIndex} className="space-y-2">
                {question.header.length > 0 ? (
                  <legend className="text-muted-foreground text-xs font-medium uppercase">
                    {question.header}
                  </legend>
                ) : null}
                <p className="text-sm font-medium">{question.question}</p>
                <div className="space-y-1.5">
                  {question.options.map((option, optionIndex) => {
                    const active = selected.includes(option.label);
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() =>
                          toggle(
                            question.question,
                            option.label,
                            question.multiSelect,
                          )
                        }
                        className={`flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent/40"
                        }`}
                      >
                        <span className="font-medium">{option.label}</span>
                        {option.description !== undefined &&
                        option.description.length > 0 ? (
                          <span className="text-muted-foreground text-xs">
                            {option.description}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <Button disabled={!allAnswered} onClick={submit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
