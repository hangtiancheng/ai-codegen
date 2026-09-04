import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "cn";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-invalid" | "aria-describedby"
> & {
  readonly label: string;
  readonly errorMessage?: string | undefined;
  readonly hint?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, errorMessage, hint, className, ...inputProps },
    ref,
  ) {
    const reactId = useId();
    const inputId = `${reactId}-input`;
    const errorId = `${reactId}-error`;
    const hintId = `${reactId}-hint`;
    const hasError = Boolean(errorMessage);
    const describedBy = [hint ? hintId : null, hasError ? errorId : null]
      .filter((value): value is string => value !== null)
      .join(" ");

    return (
      <div className="flex w-full flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-foreground text-sm font-medium"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={describedBy === "" ? undefined : describedBy}
          className={cn(
            "border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors outline-none",
            "placeholder:text-muted-foreground",
            "focus:border-ring focus:ring-ring/30 focus:ring-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
            hasError &&
              "border-destructive focus:border-destructive focus:ring-destructive/30",
            className,
          )}
          {...inputProps}
        />
        {hint && !hasError ? (
          <p id={hintId} className="text-muted-foreground text-xs">
            {hint}
          </p>
        ) : null}
        {hasError ? (
          <p
            id={errorId}
            role="alert"
            className="text-destructive text-xs font-medium"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
