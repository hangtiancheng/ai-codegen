import { forwardRef, type ReactNode, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "@/shared/lib";

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "aria-invalid" | "aria-describedby"
> & {
  readonly label?: string;
  readonly errorMessage?: string | undefined;
  readonly hint?: ReactNode;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, errorMessage, hint, className, ...textareaProps },
  ref,
) {
  const reactId = useId();
  const inputId = `${reactId}-textarea`;
  const errorId = `${reactId}-error`;
  const hintId = `${reactId}-hint`;
  const hasError = Boolean(errorMessage);
  const describedBy = [hint ? hintId : null, hasError ? errorId : null]
    .filter((value): value is string => value !== null)
    .join(" ");

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={hasError}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={cn(
          "border-input bg-background min-h-24 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-sm transition-colors outline-none",
          "placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 focus:ring-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          hasError && "border-destructive focus:border-destructive",
          className,
        )}
        {...textareaProps}
      />
      {hint && !hasError ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});
