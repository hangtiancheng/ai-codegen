import type { ReactNode } from "react";
import { Button, TextField } from "@/shared/ui";
import type { AdminAppFilterValues } from "./admin-app-query";

export type AdminAppFiltersProps = {
  readonly values: AdminAppFilterValues;
  readonly onChange: (values: AdminAppFilterValues) => void;
  readonly onSubmit: () => void;
  readonly onReset: () => void;
};

export function AdminAppFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: AdminAppFiltersProps): ReactNode {
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
        value={values.id}
        onChange={(event) => onChange({ ...values, id: event.target.value })}
      />
      <TextField
        label="App name"
        value={values.appName}
        onChange={(event) => onChange({ ...values, appName: event.target.value })}
      />
      <TextField
        label="Creator ID"
        inputMode="numeric"
        value={values.userId}
        onChange={(event) => onChange({ ...values, userId: event.target.value })}
      />
      <label className="text-foreground flex flex-col gap-1.5 text-sm font-medium">
        Codegen type
        <select
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring/30 h-10 rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-2"
          value={values.codegenType}
          onChange={(event) =>
            onChange({
              ...values,
              codegenType: parseCodegen(event.target.value),
            })
          }
        >
          <option value="">All types</option>
          <option value="VANILLA_HTML">Vanilla HTML</option>
          <option value="MULTI_FILES">Multi-files</option>
          <option value="VITE_PROJECT">Vite project</option>
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

function parseCodegen(value: string): AdminAppFilterValues["codegenType"] {
  if (value === "VANILLA_HTML" || value === "MULTI_FILES" || value === "VITE_PROJECT") {
    return value;
  }
  return "";
}
