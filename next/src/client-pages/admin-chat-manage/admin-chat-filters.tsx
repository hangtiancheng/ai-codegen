import type { ReactNode } from "react";
import { Button, TextField } from "@/shared/ui";
import type { AdminChatFilterValues } from "./admin-chat-query";

export type AdminChatFiltersProps = {
  readonly values: AdminChatFilterValues;
  readonly onChange: (values: AdminChatFilterValues) => void;
  readonly onSubmit: () => void;
  readonly onReset: () => void;
};

export function AdminChatFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: AdminChatFiltersProps): ReactNode {
  return (
    <form
      className="border-border bg-card grid gap-4 rounded-xl border p-4 shadow-sm md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField
        label="App ID"
        inputMode="numeric"
        value={values.appId}
        onChange={(event) => onChange({ ...values, appId: event.target.value })}
      />
      <TextField
        label="User ID"
        inputMode="numeric"
        value={values.userId}
        onChange={(event) => onChange({ ...values, userId: event.target.value })}
      />
      <TextField
        label="Message"
        value={values.message}
        onChange={(event) => onChange({ ...values, message: event.target.value })}
      />
      <label className="text-foreground flex flex-col gap-1.5 text-sm font-medium">
        Message type
        <select
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring/30 h-10 rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-2"
          value={values.messageType}
          onChange={(event) =>
            onChange({
              ...values,
              messageType: parseMessageType(event.target.value),
            })
          }
        >
          <option value="">All messages</option>
          <option value="user">User</option>
          <option value="ai">AI</option>
        </select>
      </label>
      <div className="flex items-end gap-2 md:col-span-4">
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </form>
  );
}

function parseMessageType(value: string): AdminChatFilterValues["messageType"] {
  if (value === "user" || value === "ai") {
    return value;
  }
  return "";
}
