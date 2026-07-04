import type { ReactNode } from "react";
import { Button, TextField } from "@/shared/ui";
import type { AdminUserFilterValues } from "./admin-user-query";

export type AdminUserFiltersProps = {
  readonly values: AdminUserFilterValues;
  readonly onChange: (values: AdminUserFilterValues) => void;
  readonly onSubmit: () => void;
  readonly onReset: () => void;
};

export function AdminUserFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: AdminUserFiltersProps): ReactNode {
  return (
    <form
      className="border-border bg-card grid gap-4 rounded-xl border p-4 shadow-sm md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField
        label="User ID"
        inputMode="numeric"
        value={values.id}
        onChange={(event) => onChange({ ...values, id: event.target.value })}
      />
      <TextField
        label="Account"
        value={values.userAccount}
        onChange={(event) => onChange({ ...values, userAccount: event.target.value })}
      />
      <TextField
        label="Username"
        value={values.username}
        onChange={(event) => onChange({ ...values, username: event.target.value })}
      />
      <label className="text-foreground flex flex-col gap-1.5 text-sm font-medium">
        Role
        <select
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring/30 h-10 rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-2"
          value={values.userRole}
          onChange={(event) => onChange({ ...values, userRole: parseRole(event.target.value) })}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
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

function parseRole(value: string): AdminUserFilterValues["userRole"] {
  if (value === "user" || value === "admin") {
    return value;
  }
  return "";
}
