import type { ReactNode } from "react";
import type { UserId, UserVo } from "@/shared/schemas";
import { Avatar, Badge, Button, DataTable, type DataTableColumn } from "@/shared/ui";
import { formatNullable, formatTimestamp } from "../admin-shared/format-admin-value";

export type AdminUserTableProps = {
  readonly users: ReadonlyArray<UserVo>;
  readonly deletingId: UserId | undefined;
  readonly onDelete: (user: UserVo) => void;
};

export function AdminUserTable({ users, deletingId, onDelete }: AdminUserTableProps): ReactNode {
  const columns = userColumns(deletingId, onDelete);
  return <DataTable records={users} columns={columns} getRowKey={(user) => user.id} />;
}

function userColumns(
  deletingId: UserId | undefined,
  onDelete: (user: UserVo) => void,
): ReadonlyArray<DataTableColumn<UserVo>> {
  return [
    { key: "id", header: "ID", render: (user) => user.id },
    { key: "account", header: "Account", render: (user) => user.userAccount },
    {
      key: "profile",
      header: "Profile",
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar src={user.userAvatar} name={user.username ?? user.userAccount} />
          <div>
            <p className="text-foreground font-medium">{formatNullable(user.username)}</p>
            <p className="text-muted-foreground max-w-48 truncate text-xs">
              {formatNullable(user.userProfile)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user) => (
        <Badge variant={user.userRole === "admin" ? "warning" : "neutral"}>{user.userRole}</Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (user) => formatTimestamp(user.createTime),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => (
        <Button
          variant="danger"
          size="sm"
          isLoading={deletingId === user.id}
          onClick={() => onDelete(user)}
        >
          Delete
        </Button>
      ),
    },
  ];
}
